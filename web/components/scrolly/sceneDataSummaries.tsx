import type { ReactNode } from 'react';
import { formatFull } from '@/lib/format/number';
import { formatPercent } from '@/lib/format/percent';
import type { DEAEnforcementAction } from '@/lib/data/schemas';

export function act1Summary({
  totalPills,
  yearly,
}: {
  totalPills: number;
  yearly: { year: number; pills: number }[];
}): ReactNode {
  return (
    <table>
      <caption>ARCOS shipments by year, 2006–2014. Total: {formatFull(totalPills)}.</caption>
      <thead>
        <tr>
          <th scope="col">Year</th>
          <th scope="col">Pills</th>
        </tr>
      </thead>
      <tbody>
        {yearly.map((row) => (
          <tr key={row.year}>
            <th scope="row">{row.year}</th>
            <td>{formatFull(row.pills)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function act2Summary({
  rows,
}: {
  rows: { distributor: string; start: number; end: number; emphasized: boolean }[];
}): ReactNode {
  return (
    <table>
      <caption>Top distributors, 2006 vs 2014 market share.</caption>
      <thead>
        <tr>
          <th scope="col">Distributor</th>
          <th scope="col">2006 share</th>
          <th scope="col">2014 share</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.distributor}>
            <th scope="row">{row.distributor}</th>
            <td>{formatPercent(row.start)}</td>
            <td>{formatPercent(row.end)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function act3Summary({ actions }: { actions: DEAEnforcementAction[] }): ReactNode {
  return (
    <table>
      <caption>DEA Diversion enforcement actions by year.</caption>
      <thead>
        <tr>
          <th scope="col">Year</th>
          <th scope="col">Actions</th>
          <th scope="col">Notable</th>
        </tr>
      </thead>
      <tbody>
        {actions.map((action) => (
          <tr key={action.year}>
            <th scope="row">{action.year}</th>
            <td>{formatFull(action.action_count)}</td>
            <td>{action.notable_actions.map((n) => n.title).join('; ')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function act4Summary({
  counties,
}: {
  counties: { fips: string; name: string; state: string; deaths: number[] }[];
}): ReactNode {
  return (
    <table>
      <caption>Overdose deaths for six heavily shipped counties, by year.</caption>
      <thead>
        <tr>
          <th scope="col">County</th>
          <th scope="col">Years</th>
          <th scope="col">Deaths (first→last)</th>
        </tr>
      </thead>
      <tbody>
        {counties.map((row) => (
          <tr key={row.fips}>
            <th scope="row">
              {row.name} ({row.state})
            </th>
            <td>{row.deaths.length}</td>
            <td>
              {formatFull(row.deaths[0] ?? 0)} → {formatFull(row.deaths[row.deaths.length - 1] ?? 0)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
