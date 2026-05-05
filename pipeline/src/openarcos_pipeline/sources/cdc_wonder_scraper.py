"""CDC WONDER D76 (Underlying Cause of Death) scraper — Playwright-driven.

Background
----------
CDC's D76 XML API refuses county-level queries (returns HTTP 500 with the
message "Only national data are available for this dataset when using the
WONDER web service"). The only working path for county × year × ICD-code
queries is the HTML UI at `https://wonder.cdc.gov/ucd-icd10.html`, whose
hierarchical Finder widgets are JavaScript-backed and will not accept a
naked form-POST from ``requests``/``httpx`` — the server replies with a
JSP template error (``{0}`` placeholder) whenever the state machine isn't
honored.

We therefore drive the UI with Playwright + Chromium. See
``pipeline/notes/cdc-investigation-2026-05-01-round2.md`` for the full
form-state investigation.

Flow
----
1. GET `https://wonder.cdc.gov/ucd-icd10.html` (landing page).
2. Click the ``I Agree`` button → browser follows POST to
   ``/controller/datarequest/D76;jsessionid=<ID>`` and receives the
   Request Form.
3. Fill in:
   - States: advanced-mode textarea with the 2-digit state FIPS.
   - Year: advanced-mode textarea with the years list.
   - Underlying cause: radio ``D76.V25`` (Drug/Alcohol Induced) +
     ``D1,D2,D3,D4`` (the macro that covers X40-X44 ∪ X60-X64 ∪ X85 ∪
     Y10-Y14 per WONDER's own mapping — no need to enumerate ICD codes
     manually).
   - Group-by: ``B_1 = D76.V9-level1`` (State), ``B_2 = D76.V9-level2``
     (County), ``B_3 = D76.V1-level1`` (Year). MUST be contiguous.
   - Show Suppressed + Show Zero Values: ``true`` (we want the full grid).
4. Click ``Send`` → Results page.
5. Click ``Export`` with format ``tsv`` → TSV download.

Responses are cached (committed) under ``data/raw/cdc/{FIPS}_{ST}.tsv`` +
``.html`` for reproducibility and audit.

Suppression
-----------
Per 42 USC 242m(d), NCHS requires counts of 9 or fewer to remain
unpublished. Cells so marked arrive as ``Suppressed`` and are preserved
as ``{deaths: None, suppressed: True}``; consumers (map layers, CSV
exports) must keep the flag and never back-fill a numeric value.
"""

from __future__ import annotations

import contextlib
import csv
import io
import os
import time
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from openarcos_pipeline.log import get_logger

log = get_logger("openarcos.sources.cdc_wonder_scraper")

LANDING_URL = "https://wonder.cdc.gov/ucd-icd10.html"
USER_AGENT = (
    "openarcos-research/1.0 (+https://openarcos.org; "
    "contact via github.com/anomalyco/opencode) Playwright/Chromium"
)

# 2-digit FIPS → USPS abbreviation for the 50 states + DC. Territories
# excluded: WONDER's D76 county-level breakdown covers US states + DC.
STATE_FIPS_TO_ABBREV: dict[str, str] = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA",
    "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL",
    "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN",
    "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME",
    "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
    "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
    "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
    "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
    "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
    "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI",
    "56": "WY",
}
ALL_STATE_FIPS = list(STATE_FIPS_TO_ABBREV.keys())


class SessionExpiredError(RuntimeError):
    """The WONDER jsessionid lapsed mid-query; caller should restart the session."""


class ScrapeError(RuntimeError):
    """Non-transient failure scraping a WONDER state query."""


# ---------- TSV parsing (pure) ----------

# CDC WONDER TSV header columns we care about. The file begins with a
# header row and data rows; the Notes/Query-Parameters/Citation blocks
# follow a `"---"` sentinel.
_HEADER_STATE_CODE = "State Code"
_HEADER_COUNTY_CODE = "County Code"
_HEADER_COUNTY = "County"
_HEADER_YEAR = "Year"
_HEADER_DEATHS = "Deaths"
_HEADER_POP = "Population"
_HEADER_RATE = "Crude Rate"


def parse_tsv(tsv_text: str) -> list[dict[str, Any]]:
    """Parse a CDC WONDER TSV export into county-year records.

    Stops when the metadata block (``"---"`` sentinel row) is reached.
    Skips rows whose Deaths cell is ``"Missing"`` (no data) — they are
    neither counted nor emitted. Rows with Deaths ``"Suppressed"`` are
    emitted with ``deaths=None, suppressed=True``. Numeric counts of 9 or
    fewer receive the same representation before public artifacts are built.
    """
    if not tsv_text.strip():
        return []

    # CDC TSVs start with a header; some rows are pure-text separators
    # like ``"---"``. We short-circuit on those.
    reader = csv.reader(io.StringIO(tsv_text), delimiter="\t", quotechar='"')
    header: list[str] | None = None
    rows: list[dict[str, Any]] = []

    for raw in reader:
        if not raw:
            continue
        if header is None:
            header = [c.strip() for c in raw]
            # The header row may have a leading empty "Notes" column in
            # some WONDER exports. We tolerate that; column names are
            # matched by string.
            if _HEADER_DEATHS not in header:
                # First row isn't the data header. Skip.
                header = None
            continue

        # Metadata sentinel: a single-cell row whose first value is "---"
        # (or starts with "Dataset" / "Query Parameters" / "Help" /
        # "Query Date" / "Suggested Citation" / ---).
        first = raw[0].strip().strip('"')
        if first == "---":
            break
        if first.startswith(
            ("Dataset:", "Query Parameters", "States:", "Year/Month:", "Group By:",
             "Show Totals", "Show Zero", "Show Suppressed",
             "Help:", "Query Date:", "Suggested Citation:",
             "Drug/Alcohol Induced Causes:")
        ):
            break

        # Align cells to header by position.
        if len(raw) < len(header):
            raw = raw + [""] * (len(header) - len(raw))

        cells = {header[i]: raw[i].strip() for i in range(len(header))}

        county_code = cells.get(_HEADER_COUNTY_CODE, "").strip()
        if not county_code.isdigit() or len(county_code) != 5:
            continue
        state_code = cells.get(_HEADER_STATE_CODE, "").strip().zfill(2)
        county_name = cells.get(_HEADER_COUNTY, "").strip()
        year_raw = cells.get(_HEADER_YEAR, "").strip()
        try:
            year = int(year_raw)
        except ValueError:
            continue

        deaths_raw = cells.get(_HEADER_DEATHS, "").strip()
        pop_raw = cells.get(_HEADER_POP, "").strip().replace(",", "")
        rate_raw = cells.get(_HEADER_RATE, "").strip()

        if deaths_raw.lower() == "missing" or deaths_raw == "":
            # 'Missing' means NCHS has no data for this cell; drop.
            continue

        suppressed = deaths_raw.lower() == "suppressed"
        unreliable = rate_raw.lower() == "unreliable"
        deaths: int | None
        if suppressed:
            deaths = None
        else:
            try:
                deaths = int(deaths_raw.replace(",", ""))
            except ValueError:
                continue
            if deaths <= 9:
                deaths = None
                suppressed = True

        try:
            population = int(pop_raw) if pop_raw else 0
        except ValueError:
            population = 0

        crude_rate: float | None
        if rate_raw.lower() in ("unreliable", "suppressed", "not applicable", ""):
            crude_rate = None
        else:
            try:
                crude_rate = float(rate_raw)
            except ValueError:
                crude_rate = None

        rows.append(
            {
                "state_fips": state_code,
                "county_fips": county_code,
                "county_name": county_name,
                "year": year,
                "deaths": deaths,
                "population": population,
                "crude_rate": crude_rate,
                "suppressed": suppressed,
                "unreliable": unreliable,
            }
        )

    return rows


# ---------- Browser-driven scrape ----------


@dataclass
class ScraperConfig:
    landing_url: str = LANDING_URL
    user_agent: str = USER_AGENT
    headless: bool = True
    nav_timeout_ms: int = 60_000
    query_timeout_ms: int = 180_000


def _default_browser_factory(config: ScraperConfig):
    """Lazily import Playwright so unit tests with stub browsers don't need it."""
    from playwright.sync_api import sync_playwright

    playwright = sync_playwright().start()
    browser = playwright.chromium.launch(headless=config.headless)
    context = browser.new_context(user_agent=config.user_agent)
    page = context.new_page()
    page.set_default_timeout(config.nav_timeout_ms)

    # Pack a closer so the caller can tear everything down.
    class _Handle:
        def __init__(self, browser, context, playwright):
            self._browser = browser
            self._context = context
            self._playwright = playwright

        def close(self):
            try:
                self._context.close()
            finally:
                try:
                    self._browser.close()
                finally:
                    self._playwright.stop()

    return _Handle(browser, context, playwright), page


class CDCWonderScraper:
    """Drive the WONDER D76 UI for one or more state-scoped queries.

    Construction:
      scraper = CDCWonderScraper()          # real Chromium
      scraper = CDCWonderScraper(browser_factory=my_stub)  # tests

    ``browser_factory`` is a zero-arg callable returning ``(browser,
    page)``. ``browser`` must have ``.close()``.
    """

    def __init__(
        self,
        config: ScraperConfig | None = None,
        browser_factory: Callable[[], tuple[Any, Any]] | None = None,
    ) -> None:
        self._config = config or ScraperConfig()
        self._factory = browser_factory or (lambda: _default_browser_factory(self._config))

    # Seam for tests: subclass or monkeypatch _drive_form to return a
    # canned TSV body rather than driving a real browser.
    def _drive_form(self, page: Any, state_fips: str, years: Iterable[int]) -> tuple[str, str]:
        """Fill the WONDER form for ``state_fips`` × ``years`` and return
        ``(results_html, export_tsv)``. Default implementation drives a
        real page.
        """
        # Stub seam: tests inject a page whose ``__dict__`` carries a
        # ``_tsv_body`` or ``_session_expired`` attribute. We check
        # ``__dict__`` (not ``getattr``) so ``MagicMock`` auto-created
        # attributes don't accidentally trip these paths.
        attrs = getattr(page, "__dict__", {})
        if attrs.get("_session_expired"):
            raise SessionExpiredError("page reports session expired")
        if "_tsv_body" in attrs:
            return "", attrs["_tsv_body"]

        return self._live_drive_form(page, state_fips, years)

    def _live_drive_form(
        self, page: Any, state_fips: str, years: Iterable[int]
    ) -> tuple[str, str]:
        """Real Playwright UI flow.

        We call the WONDER-provided JS helper ``add()`` to transfer
        selections from each Finder ``F_*`` listbox into the matching
        ``V_*`` textarea. Setting ``V_*`` textarea values directly
        doesn't work — the server re-renders the form with the textarea
        cleared, because a plain textarea write doesn't flip the finder
        state the server expects.
        """
        year_list = list(years)
        page.goto(self._config.landing_url, timeout=self._config.nav_timeout_ms)

        # I-Agree gateway.
        page.click('input[value="I Agree"]', timeout=self._config.nav_timeout_ms)
        page.wait_for_selector(
            'input[name="action-Send"]', timeout=self._config.nav_timeout_ms
        )
        page.wait_for_function(
            "typeof add === 'function'", timeout=self._config.nav_timeout_ms
        )

        # Set group-by variables. Use evaluate to set select values
        # directly and dispatch change events so WONDER's onchange
        # handlers refresh the dependent option lists.
        page.evaluate(
            """
            ({b1, b2, b3}) => {
              const setSelect = (name, value) => {
                const el = document.querySelector(`select[name="${name}"]`);
                if (!el) throw new Error(`select ${name} missing`);
                el.value = value;
                el.dispatchEvent(new Event('change', {bubbles: true}));
              };
              setSelect('B_1', b1);
              setSelect('B_2', b2);
              setSelect('B_3', b3);
            }
            """,
            {
                "b1": "D76.V9-level1",
                "b2": "D76.V9-level2",
                "b3": "D76.V1-level1",
            },
        )

        # Select the state in F_D76.V9 and call add('D76.V9').
        page.evaluate(
            """
            ({state_fips}) => {
              const f = document.querySelector('select[name="F_D76.V9"]');
              if (!f) throw new Error('F_D76.V9 missing');
              for (const opt of f.options) {
                opt.selected = (opt.value === state_fips);
              }
              // add() is a page-scoped helper that moves selected F_*
              // options into the V_* textarea in the format the server
              // expects ("<code> (Label)"). It also flips the hidden
              // O_*_fmode input as needed.
              add('D76.V9');
            }
            """,
            {"state_fips": state_fips},
        )

        # Select years in F_D76.V1 and call add('D76.V1').
        page.evaluate(
            """
            ({years}) => {
              const f = document.querySelector('select[name="F_D76.V1"]');
              if (!f) throw new Error('F_D76.V1 missing');
              const want = new Set(years.map(String));
              for (const opt of f.options) {
                opt.selected = want.has(opt.value);
              }
              add('D76.V1');
            }
            """,
            {"years": [str(y) for y in year_list]},
        )

        # Select the drug/alcohol induced causes group: O_ucd = D76.V25
        # radio, then pick D1-D4 in F_D76.V25 and add them.
        page.evaluate(
            """
            () => {
              const radio = document.querySelector('input[name="O_ucd"][value="D76.V25"]');
              if (radio) {
                radio.checked = true;
                radio.dispatchEvent(new Event('change', {bubbles: true}));
                radio.dispatchEvent(new Event('click', {bubbles: true}));
              }
              const f = document.querySelector('select[name="F_D76.V25"]');
              if (!f) throw new Error('F_D76.V25 missing');
              const want = new Set(['D1','D2','D3','D4']);
              for (const opt of f.options) {
                opt.selected = want.has(opt.value);
              }
              add('D76.V25');
            }
            """
        )

        # Show suppressed + show zeros + hide totals.
        page.evaluate(
            """
            () => {
              const set = (name, val) => {
                const el = document.querySelector(`input[name="${name}"]`);
                if (el) el.checked = !!val;
              };
              set('O_show_suppressed', true);
              set('O_show_zeros', true);
              set('O_show_totals', false);
            }
            """
        )

        # Submit the query. WONDER has duplicate "action-Send" buttons;
        # we trigger the form submit through the helper ``submitSet``
        # that the page's own buttons invoke (``onclick="submitSet(this)"``).
        # Use the header submit-button1 which is always rendered.

        # Diagnostic: verify V_* textareas are populated before submit.
        # Failure here means our evaluate() calls didn't stick (likely a
        # selector mismatch after a WONDER form-layout change). We check
        # with a hard error because silent submission of an empty form
        # is the top single cause of the server bouncing us back to the
        # Request Form 500 pages in this investigation.
        pre_submit = page.evaluate(
            """
            () => ({
              v9: (document.querySelector('textarea[name="V_D76.V9"]') || {}).value || '',
              v1: (document.querySelector('textarea[name="V_D76.V1"]') || {}).value || '',
              v25: (document.querySelector('textarea[name="V_D76.V25"]') || {}).value || '',
              o_ucd: (document.querySelector('input[name="O_ucd"]:checked') || {}).value || '',
              b1: (document.querySelector('select[name="B_1"]') || {}).value || '',
              b2: (document.querySelector('select[name="B_2"]') || {}).value || '',
              b3: (document.querySelector('select[name="B_3"]') || {}).value || '',
            })
            """
        )
        log.debug("cdc wonder pre-submit state", extra={"state": state_fips, **pre_submit})
        if not pre_submit.get("v9") or not pre_submit.get("v1") or not pre_submit.get("v25"):
            raise ScrapeError(f"pre-submit form not populated: {pre_submit}")

        # Submit. We inject a hidden ``action-Send=Send`` input and then
        # call ``form.submit()`` directly. Clicking the visible Send
        # button is intermittent in Playwright (the ``#submit-button1``
        # selector, ``locator.first.click()``, and ``.click()`` on an
        # ``input[name="action-Send"]`` locator all occasionally return
        # without firing the form's submit flow — we suspect a timing
        # race between WONDER's onclick handler and Playwright's default
        # click sequence). Direct form submission is deterministic and
        # the server treats it identically to a button click.
        page.evaluate(
            """
            () => {
              const form = document.getElementById('wonderform');
              if (!form) throw new Error('data request form (#wonderform) missing');
              let hidden = form.querySelector(
                'input[type="hidden"][name="action-Send"]'
              );
              if (!hidden) {
                hidden = document.createElement('input');
                hidden.type = 'hidden';
                hidden.name = 'action-Send';
                hidden.value = 'Send';
                form.appendChild(hidden);
              }
              form.submit();
            }
            """
        )

        # WONDER's submit POSTs the form; the server processes the
        # query (may take 20-60s for a full-state × 9-year query) and
        # responds with the Results Form HTML. We poll for the title
        # transition AND for the ``action-Export`` Download button,
        # which is the canonical signal that the Results DOM is fully
        # rendered. Waiting for title alone is insufficient — the
        # attribute is set before the form body is appended, and our
        # follow-up form.submit() then runs against a partial DOM.
        try:
            page.wait_for_function(
                "document.title.includes('Results Form') "
                "|| document.title.includes('WONDER Message') "
                "|| document.body.innerText.includes('Processing Error') "
                "|| document.body.innerText.includes('System Busy')",
                timeout=self._config.query_timeout_ms,
            )
            if "Results Form" in (page.title() or ""):
                page.wait_for_selector(
                    'input[name="action-Export"]',
                    state="attached",
                    timeout=self._config.nav_timeout_ms,
                )
        except Exception:
            # Post-submit title didn't transition. Capture diagnostic
            # page content before raising so we can tell whether we hit
            # a soft rate-limit, a malformed form echo, or a processing
            # interstitial that needs a longer wait.
            if os.environ.get("OPENARCOS_SCRAPER_DEBUG"):
                dbg = Path(os.environ["OPENARCOS_SCRAPER_DEBUG"])
                dbg.mkdir(parents=True, exist_ok=True)
                with contextlib.suppress(Exception):
                    (dbg / f"{state_fips}_wait_timeout.html").write_text(
                        page.content()
                    )
                    (dbg / f"{state_fips}_wait_timeout.title").write_text(
                        page.title() or ""
                    )
            raise

        # Session expiry / error detection.
        title = page.title().strip().lower()
        if "session" in title and "expired" in title:
            raise SessionExpiredError(f"Results page title: {title!r}")
        results_html = page.content()
        if "Your session has timed out" in results_html:
            raise SessionExpiredError("session timed-out banner in results page")
        # If we're still on the Request Form after Send, the submission
        # was rejected by server-side validation.
        if "Request Form" in (page.title() or ""):
            if os.environ.get("OPENARCOS_SCRAPER_DEBUG"):
                dbg = Path(os.environ["OPENARCOS_SCRAPER_DEBUG"])
                dbg.mkdir(parents=True, exist_ok=True)
                (dbg / f"{state_fips}_post_send.html").write_text(results_html)
                log.warning("scraper debug HTML → %s", dbg)
            raise ScrapeError(
                f"WONDER re-rendered the Request Form for state {state_fips} "
                "— server validation likely failed"
            )

        # Export TSV. On the Results page there is an explicit
        # ``action-Export`` Download button; clicking it with the export
        # format select set to ``tsv`` triggers a file download.
        if os.environ.get("OPENARCOS_SCRAPER_DEBUG"):
            dbg = Path(os.environ["OPENARCOS_SCRAPER_DEBUG"])
            dbg.mkdir(parents=True, exist_ok=True)
            (dbg / f"{state_fips}_pre_export.html").write_text(results_html)

        page.evaluate(
            """
            () => {
              const sel = document.querySelector('select[name="O_export-format"]');
              if (sel) {
                sel.value = 'tsv';
                sel.dispatchEvent(new Event('change', {bubbles: true}));
              }
              // Some Results Form variants render an
              // ``O_change_action-Send-Export Results`` checkbox; others
              // expose an ``action-Export`` submit button directly. We
              // satisfy either path by ticking the checkbox if it
              // exists.
              const cb = document.querySelector('input[name="O_change_action-Send-Export Results"]');
              if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change', {bubbles: true})); }
            }
            """
        )
        # Trigger the Export download via form.submit() with an injected
        # ``action-Export=Export`` hidden input. Same reasoning as the
        # Send submit above.
        with page.expect_download(timeout=self._config.query_timeout_ms) as dl_info:
            page.evaluate(
                """
                () => {
                  const form = document.getElementById('wonderform');
                  if (!form) throw new Error('data request form (#wonderform) missing');
                  // Remove any prior action-* hidden inputs we added.
                  for (const n of ['action-Send','action-Export']) {
                    const el = form.querySelector(
                      `input[type="hidden"][name="${n}"]`
                    );
                    if (el) el.remove();
                  }
                  const hidden = document.createElement('input');
                  hidden.type = 'hidden';
                  hidden.name = 'action-Export';
                  hidden.value = 'Export';
                  form.appendChild(hidden);
                  form.submit();
                }
                """
            )
        download = dl_info.value
        path = download.path()
        tsv = Path(path).read_text() if path else ""
        if not tsv:
            raise ScrapeError(f"empty TSV download for state {state_fips}")
        return results_html, tsv

    def scrape_state(
        self,
        state_fips: str,
        years: Iterable[int],
        cache_dir: Path | None = None,
    ) -> list[dict[str, Any]]:
        """Fetch one state's county × year grid.

        When ``cache_dir`` is provided, writes
        ``{cache_dir}/{FIPS}_{ABBREV}.{html,tsv}`` for audit.
        """
        years = list(years)
        state_fips = state_fips.zfill(2)
        abbrev = STATE_FIPS_TO_ABBREV.get(state_fips, "XX")

        browser, page = self._factory()
        try:
            html, tsv = self._drive_form(page, state_fips, years)
        finally:
            with contextlib.suppress(Exception):
                browser.close()

        if cache_dir is not None:
            cache_dir = Path(cache_dir)
            cache_dir.mkdir(parents=True, exist_ok=True)
            if html:
                (cache_dir / f"{state_fips}_{abbrev}.html").write_text(html)
            (cache_dir / f"{state_fips}_{abbrev}.tsv").write_text(tsv)

        return parse_tsv(tsv)


# ---------- Multi-state runner ----------


def fetch_all_states(
    years: Iterable[int],
    states: Iterable[str] | None = None,
    delay_s: int = 15,
    cache_dir: Path | None = None,
    max_retries: int = 3,
    scraper: CDCWonderScraper | None = None,
    continue_on_failure: bool = True,
    skip_cached: bool = False,
) -> list[dict[str, Any]]:
    """Fetch every US state (+ DC) county×year grid, one at a time.

    Respects ``delay_s`` between state queries (15s minimum per WONDER's
    published API rate floor). Retries transient per-state failures up
    to ``max_retries`` times with exponential-backoff sleep.

    When ``skip_cached=True`` and a prior ``{cache_dir}/{FIPS}_{ST}.tsv``
    file exists, the scrape is skipped and its cached TSV is parsed
    back. This makes long multi-state runs resumable after a crash.

    On terminal per-state failure with ``continue_on_failure=True``, logs
    a warning and proceeds; the returned list simply lacks that state's
    rows. The caller can diff scraped state codes against the expected
    set to detect missing states.
    """
    years = list(years)
    states = list(states or ALL_STATE_FIPS)
    scraper = scraper or CDCWonderScraper()
    results: list[dict[str, Any]] = []
    failures: list[tuple[str, Exception]] = []

    last_call_at: float | None = None

    for state_fips in states:
        state_fips = state_fips.zfill(2)
        abbrev = STATE_FIPS_TO_ABBREV.get(state_fips, "XX")

        # Resume-from-cache: if we already have a TSV for this state,
        # parse it and skip the scrape.
        if skip_cached and cache_dir is not None:
            cached_tsv = Path(cache_dir) / f"{state_fips}_{abbrev}.tsv"
            if cached_tsv.exists():
                log.info(
                    "cdc wonder scrape: reusing cached TSV",
                    extra={"state": state_fips, "path": str(cached_tsv)},
                )
                results.extend(parse_tsv(cached_tsv.read_text()))
                continue

        if last_call_at is not None:
            elapsed = time.monotonic() - last_call_at
            remaining = delay_s - elapsed
            if remaining > 0:
                time.sleep(remaining)

        ok = False
        last_err: Exception | None = None
        for attempt in range(1, max_retries + 1):
            try:
                log.info(
                    "cdc wonder scrape",
                    extra={"state": state_fips, "attempt": attempt},
                )
                rows = scraper.scrape_state(
                    state_fips=state_fips, years=years, cache_dir=cache_dir
                )
                results.extend(rows)
                ok = True
                break
            except SessionExpiredError as e:
                # Session expiry: retry with backoff; Playwright opens a
                # fresh session on each scrape_state call already.
                last_err = e
                log.warning(
                    "cdc wonder session expired; retrying",
                    extra={"state": state_fips, "attempt": attempt},
                )
                time.sleep(min(60, 5 * attempt))
            except Exception as e:
                last_err = e
                log.warning(
                    "cdc wonder scrape error",
                    extra={"state": state_fips, "attempt": attempt, "err": str(e)},
                )
                time.sleep(min(60, 5 * attempt))

        last_call_at = time.monotonic()
        if not ok:
            failures.append((state_fips, last_err or RuntimeError("unknown failure")))
            if not continue_on_failure:
                raise ScrapeError(
                    f"state {state_fips} failed after {max_retries} attempts"
                ) from last_err

    if failures:
        log.error(
            "cdc wonder scrape: %d states failed: %s",
            len(failures),
            [f[0] for f in failures],
        )

    return results


# ---------- CLI ----------


def _parse_years(spec: str) -> list[int]:
    if "-" in spec:
        lo, hi = spec.split("-", 1)
        return list(range(int(lo), int(hi) + 1))
    return [int(y) for y in spec.split(",")]


def main(argv: list[str] | None = None) -> int:
    import argparse
    import json

    ap = argparse.ArgumentParser(prog="cdc_wonder_scraper")
    ap.add_argument("--years", default="2006-2014", help="Year range (e.g. 2006-2014)")
    ap.add_argument("--states", default="", help="Comma-separated FIPS (blank = all 50+DC)")
    ap.add_argument("--all-states", action="store_true", help="Scrape 50 states + DC")
    ap.add_argument("--cache-dir", default="data/raw/cdc", help="Raw-cache dir")
    ap.add_argument(
        "--delay", type=int, default=15, help="Seconds between state queries (>=15)"
    )
    ap.add_argument(
        "--skip-cached",
        action="store_true",
        help="Reuse existing {cache_dir}/{FIPS}_{ST}.tsv files (resume after crash)",
    )
    ap.add_argument(
        "--out",
        default="data/processed/cdc_wonder_scraped.json",
        help="Destination JSON",
    )
    args = ap.parse_args(argv)

    years = _parse_years(args.years)
    if args.all_states or not args.states:
        states = ALL_STATE_FIPS
    else:
        states = [s.strip().zfill(2) for s in args.states.split(",") if s.strip()]

    cache = Path(args.cache_dir)
    cache.mkdir(parents=True, exist_ok=True)

    rows = fetch_all_states(
        years=years,
        states=states,
        delay_s=args.delay,
        cache_dir=cache,
        skip_cached=args.skip_cached,
    )

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(rows, indent=2))
    print(f"wrote {len(rows)} rows to {out}")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
