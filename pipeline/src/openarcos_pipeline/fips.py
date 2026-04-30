"""FIPS county code helpers."""

from __future__ import annotations

FIPS_STATE_MAP = {
    "01": "AL",
    "02": "AK",
    "04": "AZ",
    "05": "AR",
    "06": "CA",
    "08": "CO",
    "09": "CT",
    "10": "DE",
    "11": "DC",
    "12": "FL",
    "13": "GA",
    "15": "HI",
    "16": "ID",
    "17": "IL",
    "18": "IN",
    "19": "IA",
    "20": "KS",
    "21": "KY",
    "22": "LA",
    "23": "ME",
    "24": "MD",
    "25": "MA",
    "26": "MI",
    "27": "MN",
    "28": "MS",
    "29": "MO",
    "30": "MT",
    "31": "NE",
    "32": "NV",
    "33": "NH",
    "34": "NJ",
    "35": "NM",
    "36": "NY",
    "37": "NC",
    "38": "ND",
    "39": "OH",
    "40": "OK",
    "41": "OR",
    "42": "PA",
    "44": "RI",
    "45": "SC",
    "46": "SD",
    "47": "TN",
    "48": "TX",
    "49": "UT",
    "50": "VT",
    "51": "VA",
    "53": "WA",
    "54": "WV",
    "55": "WI",
    "56": "WY",
    "60": "AS",
    "66": "GU",
    "69": "MP",
    "72": "PR",
    "78": "VI",
}


def normalize_fips(value: object) -> str:
    """Return a 5-character zero-padded FIPS string.

    Accepts int or str (incl. with whitespace). Raises ValueError on empty,
    non-digit, or too-long inputs. Raises TypeError on None / non-str-non-int.
    """
    if value is None:
        raise TypeError("fips cannot be None")
    if isinstance(value, bool):
        raise TypeError("fips cannot be bool")
    if isinstance(value, int):
        s = str(value)
    elif isinstance(value, str):
        s = value.strip()
    else:
        raise TypeError(f"fips must be str or int, got {type(value).__name__}")

    if not s:
        raise ValueError("fips is empty")
    if not s.isdigit():
        raise ValueError(f"fips has non-digit chars: {s!r}")
    if len(s) > 5:
        raise ValueError(f"fips too long: {s!r}")
    return s.zfill(5)


def is_valid_fips(value: object) -> bool:
    """True if `value` is already a proper 5-digit FIPS with known state prefix.

    Unlike `normalize_fips`, this does NOT zero-pad shorter inputs. It is meant
    for validating inputs that should already be in canonical form.
    """
    if not isinstance(value, str):
        return False
    s = value.strip()
    if len(s) != 5 or not s.isdigit():
        return False
    return s[:2] in FIPS_STATE_MAP


def state_from_fips(value: object) -> str:
    """Return the 2-letter USPS state code for a FIPS."""
    normed = normalize_fips(value)
    prefix = normed[:2]
    if prefix not in FIPS_STATE_MAP:
        raise ValueError(f"unknown state prefix in fips: {normed}")
    return FIPS_STATE_MAP[prefix]
