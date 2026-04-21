import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import io

# Vehicle category mapping (case-insensitive partial match)
LCV_KEYWORDS = [
    'eicher pro', 'montra', 'switch iev4', 'switch iiev4', 'tata ultra e12',
    'tata ultra e7', 'tata ultra e9', 'tata ultra e.7', 'tata ultra e.9',
    'switch intra'
]
SCV_KEYWORDS = [
    'tata ace 1000', 'tata ace pro', 'mahindra zeo', 'tata ace ev', 'tata ace'
]
W3_KEYWORDS = ['3w - l5', '3w', '3wl5']

STAGE_PROBABILITY = {
    'New': 0.10,
    'Requirements Gathering': 0.20,
    'Proposal Sent': 0.30,
    'Negotiation': 0.75,
    'Contracting': 0.90,
    'Closed Won': 1.00,
    'Pending Deployment': 1.00,
    'Dormant': 0.05,
    'Closed Lost': 0.00,
}

STAGE_ORDER = [
    'New', 'Requirements Gathering', 'Proposal Sent', 'Negotiation',
    'Contracting', 'Closed Won', 'Pending Deployment', 'Dormant', 'Closed Lost'
]

PROJECT_STATUS_ORDER = [
    'Pending Deployment', 'Partially Deployed', 'Deployed', 'On Hold', 'Lost'
]


def get_vehicle_category(vtype):
    if not isinstance(vtype, str):
        return 'Others'
    v = vtype.strip().lower()

    # Check LCV keywords
    for kw in LCV_KEYWORDS:
        if kw in v:
            return 'LCV'

    # Check SCV keywords (tata ace must come after tata ace 1000, tata ace pro, tata ace ev)
    for kw in SCV_KEYWORDS:
        if kw in v:
            return 'SCV'

    # Check 3W keywords
    for kw in W3_KEYWORDS:
        if kw in v:
            return '3W L5'

    # PTL or others
    if 'ptl' in v:
        return 'Others'

    return 'Others'


def parse_deal_size(val):
    if pd.isna(val):
        return 0.0
    s = str(val).replace(',', '').replace(' ', '').strip()
    if s == '' or s.lower() == 'nan':
        return 0.0
    try:
        return float(s)
    except (ValueError, TypeError):
        return 0.0


def parse_date(val):
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return None
    if isinstance(val, pd.Timestamp):
        return val
    if isinstance(val, datetime):
        return pd.Timestamp(val)
    s = str(val).strip()
    if s == '' or s.lower() == 'nan' or s.lower() == 'nat':
        return None

    formats = ['%d-%m-%Y %I:%M %p', '%d-%m-%Y', '%Y-%m-%d']
    for fmt in formats:
        try:
            return pd.Timestamp(datetime.strptime(s, fmt))
        except (ValueError, TypeError):
            pass

    try:
        return pd.to_datetime(s, dayfirst=True)
    except Exception:
        return None


def safe_float(val, default=0.0):
    if val is None:
        return default
    try:
        f = float(val)
        if np.isnan(f) or np.isinf(f):
            return default
        return f
    except (ValueError, TypeError):
        return default


def safe_int(val, default=0):
    try:
        return int(val)
    except (ValueError, TypeError):
        return default


def _fmt_date(ts):
    """Format a Timestamp as 'YYYY-MM-DD HH:MM', or '' if null."""
    if isinstance(ts, pd.Timestamp):
        return ts.strftime('%Y-%m-%d %H:%M')
    return ''


def _date_ts(ts):
    """Return a Timestamp for sorting; NaT / None maps to epoch 0."""
    if isinstance(ts, pd.Timestamp) and not pd.isna(ts):
        return ts
    return pd.Timestamp(0)


_GEO_REGION_ORDER = ['North', 'West', 'South', 'East', 'Other']


def _build_geo_nested(rows):
    """Build Region→City→Client→Vehicle tree from flat geo rows.
    Each level aggregates fleet. Sorted desc by fleet at every level.
    """
    regions = {}
    for r in rows:
        reg    = r['region']
        city   = r['city']
        client = r['client']
        vtype  = r['vehicle_type']
        fleet  = r['fleet']

        if reg not in regions:
            regions[reg] = {'region': reg, 'fleet': 0.0, 'cities': {}}
        regions[reg]['fleet'] += fleet

        if city not in regions[reg]['cities']:
            regions[reg]['cities'][city] = {'city': city, 'fleet': 0.0, 'clients': {}}
        regions[reg]['cities'][city]['fleet'] += fleet

        clients = regions[reg]['cities'][city]['clients']
        if client not in clients:
            clients[client] = {'client': client, 'fleet': 0.0, 'vehicles': []}
        clients[client]['fleet'] += fleet
        clients[client]['vehicles'].append({
            'vehicle': vtype,
            'fleet':   round(float(fleet), 2),
            'stage':   r['stage'],
            'source':  r['source'],
        })

    result = []
    for reg_key in _GEO_REGION_ORDER:
        if reg_key not in regions:
            continue
        reg_data = regions[reg_key]
        cities_list = sorted(
            [
                {
                    'city':     city_key,
                    'fleet':    round(city_val['fleet'], 2),
                    'children': sorted(
                        [
                            {
                                'client':   cli_key,
                                'fleet':    round(cli_val['fleet'], 2),
                                'children': sorted(
                                    cli_val['vehicles'],
                                    key=lambda v: -v['fleet']
                                )
                            }
                            for cli_key, cli_val in city_val['clients'].items()
                        ],
                        key=lambda c: -c['fleet']
                    )
                }
                for city_key, city_val in reg_data['cities'].items()
            ],
            key=lambda c: -c['fleet']
        )
        result.append({
            'region':   reg_key,
            'fleet':    round(reg_data['fleet'], 2),
            'children': cities_list,
        })
    return result


def _fmt_month_label(period_str):
    """Convert '2026-04' to 'Apr-26'."""
    try:
        dt = datetime.strptime(period_str, '%Y-%m')
        return dt.strftime('%b-%y')
    except Exception:
        return period_str


def _max_ts(ts1, ts2):
    """Return the later of two Timestamps; falls back to whichever is valid."""
    t1_valid = isinstance(ts1, pd.Timestamp) and not pd.isna(ts1)
    t2_valid = isinstance(ts2, pd.Timestamp) and not pd.isna(ts2)
    if t1_valid and t2_valid:
        return max(ts1, ts2)
    if t1_valid:
        return ts1
    if t2_valid:
        return ts2
    return None


def _norm_header(s):
    """Normalize a CSV header: lowercase, strip, collapse whitespace, drop punctuation."""
    if s is None:
        return ''
    t = str(s).strip().lower()
    # drop colons, underscores, dashes, extra punctuation; collapse whitespace
    for ch in [':', '_', '-', '.', '/', '\\']:
        t = t.replace(ch, ' ')
    return ' '.join(t.split())


def _build_rename_map(raw_columns, col_map):
    """Return {actual_col_name: canonical_col_name} for columns present in raw_columns,
    matching ignoring case/whitespace/punctuation variations.
    """
    norm_to_canon = {_norm_header(k): v for k, v in col_map.items()}
    rename = {}
    for actual in raw_columns:
        key = _norm_header(actual)
        if key in norm_to_canon:
            rename[actual] = norm_to_canon[key]
    return rename


def process_csvs(deals_bytes, projects_bytes):
    # ─── Read CSVs ────────────────────────────────────────────────────────────
    deals_raw = pd.read_csv(io.BytesIO(deals_bytes))
    projects_raw = pd.read_csv(io.BytesIO(projects_bytes))

    # ─── Normalize Deals ──────────────────────────────────────────────────────
    col_map_deals = {
        'Deal Name': 'deal_name',
        'Organization Name': 'org_name',
        'Sales Stage': 'stage',
        'City': 'city',
        'Vehicle Type': 'vehicle_type',
        'Deal Size': 'deal_size',
        'Driver Type': 'driver_type',
        'Charging Scope': 'charging_scope',
        'Assigned To': 'assigned_to',
        'Close Date': 'closed_date',
        'Modified Time': 'modified_date',
        'Created Time': 'created_date',
        'Quote': 'quote',
        'Total Cost': 'total_cost',
    }
    deals_rename = _build_rename_map(deals_raw.columns, col_map_deals)
    df = deals_raw.rename(columns=deals_rename).copy()

    # Ensure all expected deal columns exist
    for col in ['deal_name', 'org_name', 'stage', 'city', 'vehicle_type',
                'deal_size', 'driver_type', 'charging_scope', 'assigned_to',
                'closed_date', 'modified_date', 'created_date', 'quote', 'total_cost']:
        if col not in df.columns:
            df[col] = None

    # Parse numeric / date columns for deals
    df['deal_size'] = df['deal_size'].apply(parse_deal_size)
    df['quote'] = df['quote'].apply(parse_deal_size)
    df['total_cost'] = df['total_cost'].apply(parse_deal_size)
    df['created_date'] = df['created_date'].apply(parse_date)
    df['closed_date'] = df['closed_date'].apply(parse_date)
    df['modified_date'] = df['modified_date'].apply(parse_date)

    # Per-deal margin: only where quote > 0 and total_cost > 0
    margin_mask = (df['quote'] > 0) & (df['total_cost'] > 0)
    df['margin'] = None
    df['margin_percent'] = None
    df.loc[margin_mask, 'margin'] = df.loc[margin_mask, 'quote'] - df.loc[margin_mask, 'total_cost']
    df.loc[margin_mask, 'margin_percent'] = (
        df.loc[margin_mask, 'margin'] / df.loc[margin_mask, 'quote'] * 100
    )

    # avg_margin_percent: Closed Won deals only, weighted avg (sum margin / sum quote)
    cw_margin_df = df[
        (df['stage'] == 'Closed Won') & (df['quote'] > 0) & (df['total_cost'] > 0)
    ]
    if len(cw_margin_df) > 0:
        total_margin_sum = safe_float(cw_margin_df['margin'].sum())
        total_quote_sum = safe_float(cw_margin_df['quote'].sum())
        avg_margin_percent = (total_margin_sum / total_quote_sum * 100) if total_quote_sum > 0 else 0.0
    else:
        avg_margin_percent = 0.0

    # Derive client_name: prefer org_name, fall back to deal_name
    df['org_name'] = df['org_name'].fillna('').astype(str).str.strip()
    df['deal_name'] = df['deal_name'].fillna('').astype(str).str.strip()
    df['client_name'] = df['org_name'].where(df['org_name'] != '', df['deal_name'])
    df['client_name'] = df['client_name'].replace('', 'Unknown').fillna('Unknown')

    # Add vehicle category
    df['vehicle_category'] = df['vehicle_type'].apply(get_vehicle_category)

    # Fill remaining nulls
    df['city'] = df['city'].fillna('Unknown')
    df['vehicle_type'] = df['vehicle_type'].fillna('Unknown')
    df['stage'] = df['stage'].fillna('Unknown')
    df['deal_size'] = df['deal_size'].fillna(0)
    df['assigned_to'] = df['assigned_to'].fillna('')
    df['driver_type'] = df['driver_type'].fillna('').astype(str).str.strip()
    df['charging_scope'] = df['charging_scope'].fillna('').astype(str).str.strip()
    # Remove literal 'nan' strings that can appear after astype(str)
    df.loc[df['driver_type'] == 'nan', 'driver_type'] = ''
    df.loc[df['charging_scope'] == 'nan', 'charging_scope'] = ''

    df = df.reset_index(drop=True)

    # ─── Normalize Projects ───────────────────────────────────────────────────
    col_map_projects = {
        'Project Name': 'project_name',
        'Status': 'status',
        'City': 'city',
        'Vehicle Type': 'vehicle_type',
        'Fleet Size': 'fleet_size',
        'Assigned To': 'assigned_to',
        'Modified Time': 'modified_date',
        'Created Time': 'created_date',
        'Is Converted From Deal': 'is_converted_from_deal',
    }
    proj_rename = _build_rename_map(projects_raw.columns, col_map_projects)
    proj = projects_raw.rename(columns=proj_rename).copy()

    # Ensure all expected project columns exist
    for col in ['project_name', 'status', 'city', 'vehicle_type', 'fleet_size',
                'assigned_to', 'modified_date', 'created_date']:
        if col not in proj.columns:
            proj[col] = None

    proj['fleet_size'] = proj['fleet_size'].apply(parse_deal_size)
    proj['created_date'] = proj['created_date'].apply(parse_date)
    proj['modified_date'] = proj['modified_date'].apply(parse_date)

    proj['project_name'] = proj['project_name'].fillna('').astype(str).str.strip()
    proj['status'] = proj['status'].fillna('Unknown').astype(str).str.strip()
    proj['city'] = proj['city'].fillna('Unknown')
    proj['vehicle_type'] = proj['vehicle_type'].fillna('Unknown')
    proj['fleet_size'] = proj['fleet_size'].fillna(0)
    proj['assigned_to'] = proj['assigned_to'].fillna('')

    # Normalize is_converted_from_deal
    if 'is_converted_from_deal' not in proj.columns:
        proj['is_converted_from_deal'] = 'No'
    proj['is_converted_from_deal'] = proj['is_converted_from_deal'].fillna('No').astype(str).str.strip()
    proj['is_converted'] = proj['is_converted_from_deal'].str.lower() == 'yes'

    proj = proj.reset_index(drop=True)

    # ─── Build Merge Map ─────────────────────────────────────────────────────
    # For converted projects: match to a deal by name + city + vehicle_type + fleet_size == deal_size
    # merge_map: {proj_idx -> deal_idx}
    merge_map = {}
    merged_deal_idxs = set()

    # Build lookup index for deals to speed up matching
    # Key: (deal_name_lower, city_lower, vehicle_type_lower, deal_size) -> deal_idx
    deal_lookup = {}
    for didx, drow in df.iterrows():
        key = (
            str(drow['deal_name']).strip().lower(),
            str(drow['city']).strip().lower(),
            str(drow['vehicle_type']).strip().lower(),
            round(float(drow['deal_size']), 2),
        )
        # If multiple deals match the same key, take the first one
        if key not in deal_lookup:
            deal_lookup[key] = didx

    for pidx, prow in proj[proj['is_converted']].iterrows():
        key = (
            str(prow['project_name']).strip().lower(),
            str(prow['city']).strip().lower(),
            str(prow['vehicle_type']).strip().lower(),
            round(float(prow['fleet_size']), 2),
        )
        if key in deal_lookup:
            didx = deal_lookup[key]
            # Avoid mapping two projects to the same deal
            if didx not in merged_deal_idxs:
                merge_map[pidx] = didx
                merged_deal_idxs.add(didx)

    # Reverse map: deal_idx -> proj_idx
    deal_to_proj_map = {v: k for k, v in merge_map.items()}

    # ─── Computed deal subsets ────────────────────────────────────────────────
    closed_won = df[df['stage'] == 'Closed Won']
    not_lost = df[df['stage'] != 'Closed Lost']

    # ─── KPIs ─────────────────────────────────────────────────────────────────
    # total_opps: deals + non-converted projects (no double-counting)
    proj_not_converted_count = int((~proj['is_converted']).sum())
    total_opps = len(df) + proj_not_converted_count

    # pipeline_fleet:
    #   - Not-lost deals, EXCLUDING Closed Won deals that have a converted project
    #   - Non-converted pending deployment projects
    cw_with_proj_idxs = merged_deal_idxs & set(closed_won.index)
    pipeline_deals = not_lost[~not_lost.index.isin(cw_with_proj_idxs)]

    proj_pending_new = proj[
        (proj['status'] == 'Pending Deployment') & (~proj['is_converted'])
    ]
    pipeline_value = safe_float(pipeline_deals['deal_size'].sum()) + safe_float(proj_pending_new['fleet_size'].sum())

    closed_won_value = safe_float(closed_won['deal_size'].sum())

    # total_pending_deployment: sum of ALL pending projects fleet
    pending_value = safe_float(proj[proj['status'] == 'Pending Deployment']['fleet_size'].sum())

    positive_deals = df[df['deal_size'] > 0]['deal_size']
    avg_deal_size = safe_float(positive_deals.mean() if len(positive_deals) > 0 else 0)
    win_rate = safe_float(len(closed_won) / total_opps * 100 if total_opps > 0 else 0)

    # avg_tat_days: Close Date - Created Time for Closed Won deals only
    cw_tat = closed_won[closed_won['created_date'].notna() & closed_won['closed_date'].notna()].copy()
    cw_tat['tat_days'] = (cw_tat['closed_date'] - cw_tat['created_date']).dt.days.clip(lower=0)
    avg_tat_days = safe_float(cw_tat['tat_days'].mean() if len(cw_tat) > 0 else 0)

    # Closed won in last 90 days (for pipeline_coverage, kept for backward compat)
    now = pd.Timestamp.now()
    ninety_ago = now - pd.Timedelta(days=90)
    closed_last_90 = closed_won[
        closed_won['closed_date'].notna() &
        (closed_won['closed_date'] >= ninety_ago)
    ]['deal_size'].sum()
    pipeline_coverage = safe_float(pipeline_value / closed_last_90 if closed_last_90 > 0 else 0)

    kpis = {
        'total_pipeline_value': pipeline_value,
        'total_closed_won': closed_won_value,
        'total_pending_deployment': pending_value,
        'total_opportunities': safe_int(total_opps),
        'avg_deal_size': avg_deal_size,
        'win_rate': win_rate,
        'pipeline_coverage_ratio': pipeline_coverage,
        'avg_tat_days': avg_tat_days,
        'avg_margin_percent': round(avg_margin_percent, 2),
    }

    # ─── Stage Summary — Deals ────────────────────────────────────────────────
    stage_grp = df.groupby('stage').agg(
        count=('stage', 'count'),
        total_deal_size=('deal_size', 'sum')
    ).reset_index()

    stage_order_map = {s: i for i, s in enumerate(STAGE_ORDER)}
    stage_grp['_order'] = stage_grp['stage'].map(lambda s: stage_order_map.get(s, 999))
    stage_grp = stage_grp.sort_values('_order').drop(columns='_order')

    stage_summary = [
        {
            'stage': row['stage'],
            'count': safe_int(row['count']),
            'total_deal_size': safe_float(row['total_deal_size'])
        }
        for _, row in stage_grp.iterrows()
    ]

    # ─── Stage Summary — Projects ─────────────────────────────────────────────
    proj_stage_grp = proj.groupby('status').agg(
        count=('status', 'count'),
        total_deal_size=('fleet_size', 'sum')   # reuse field name for frontend compat
    ).reset_index().rename(columns={'status': 'stage'})

    proj_status_order_map = {s: i for i, s in enumerate(PROJECT_STATUS_ORDER)}
    proj_stage_grp['_order'] = proj_stage_grp['stage'].map(
        lambda s: proj_status_order_map.get(s, len(PROJECT_STATUS_ORDER))
    )
    proj_stage_grp = proj_stage_grp.sort_values('_order').drop(columns='_order')

    projects_stage_summary = [
        {
            'stage': row['stage'],
            'count': safe_int(row['count']),
            'total_deal_size': safe_float(row['total_deal_size'])
        }
        for _, row in proj_stage_grp.iterrows()
    ]

    # ─── Advanced Metrics (deals only) ───────────────────────────────────────
    adv_stages = ['Negotiation', 'Contracting', 'Closed Won']
    adv_df = df[df['stage'].isin(adv_stages)]
    adv_total = safe_float(adv_df['deal_size'].sum())
    adv_grp = adv_df.groupby('stage').agg(
        count=('stage', 'count'),
        total_deal_size=('deal_size', 'sum')
    ).reset_index()

    advanced_metrics = [
        {
            'stage': row['stage'],
            'count': safe_int(row['count']),
            'total_deal_size': safe_float(row['total_deal_size']),
            'pct_contribution': safe_float(
                row['total_deal_size'] / adv_total * 100 if adv_total > 0 else 0
            )
        }
        for _, row in adv_grp.iterrows()
    ]

    # ─── Top Clients (Deals not-lost + Pending Deployment projects) ─────────
    # Build a unified client→fleet view for insights
    deal_client_fleet = not_lost[['client_name', 'deal_size']].rename(
        columns={'deal_size': '_fleet'}
    ).copy()

    proj_pending_clients = proj[proj['status'] == 'Pending Deployment'].copy()
    proj_pending_clients['client_name'] = proj_pending_clients['project_name']
    proj_pending_clients = proj_pending_clients[['client_name', 'fleet_size']].rename(
        columns={'fleet_size': '_fleet'}
    )

    ci_combined = pd.concat([deal_client_fleet, proj_pending_clients], ignore_index=True)
    top_clients_df = ci_combined.groupby('client_name').agg(
        total_deal_size=('_fleet', 'sum'),
        count=('_fleet', 'count'),
        avg_deal_size=('_fleet', 'mean')
    ).reset_index().sort_values('total_deal_size', ascending=False).head(10)

    top_clients = [
        {
            'client_name': row['client_name'],
            'total_deal_size': safe_float(row['total_deal_size']),
            'count': safe_int(row['count']),
            'avg_deal_size': safe_float(row['avg_deal_size'])
        }
        for _, row in top_clients_df.iterrows()
    ]

    # ─── Funnel (deals only) ──────────────────────────────────────────────────
    funnel_stages = ['New', 'Requirements Gathering', 'Proposal Sent',
                     'Negotiation', 'Contracting', 'Closed Won']
    funnel_data = []
    prev_count = None
    for stage in funnel_stages:
        stage_rows = df[df['stage'] == stage]
        cnt = len(stage_rows)
        ds = safe_float(stage_rows['deal_size'].sum())
        conv = None
        if prev_count is not None and prev_count > 0:
            conv = safe_float(cnt / prev_count * 100)
        funnel_data.append({
            'stage': stage,
            'count': safe_int(cnt),
            'deal_size': ds,
            'conversion_pct': conv
        })
        prev_count = cnt

    # ─── Velocity (deals only) ────────────────────────────────────────────────
    cw_dated = closed_won[
        closed_won['created_date'].notna() &
        closed_won['closed_date'].notna()
    ].copy()
    cw_dated['days_to_close'] = (
        cw_dated['closed_date'] - cw_dated['created_date']
    ).dt.days.clip(lower=0)

    avg_days = safe_float(cw_dated['days_to_close'].mean() if len(cw_dated) > 0 else 0)
    cw_count = len(closed_won)
    cw_avg_size = safe_float(closed_won['deal_size'].mean() if cw_count > 0 else 0)
    wr_decimal = win_rate / 100.0
    sales_velocity = safe_float(
        (cw_count * cw_avg_size * wr_decimal) / max(avg_days, 1)
    )

    velocity = {
        'avg_days_to_close': avg_days,
        'sales_velocity': sales_velocity,
    }

    # ─── MoM Performance (deals only) ────────────────────────────────────────
    cw_with_date = closed_won[closed_won['closed_date'].notna()].copy()
    mom_performance = []
    if len(cw_with_date) > 0:
        cw_with_date['month'] = cw_with_date['closed_date'].dt.to_period('M').astype(str)
        mom_grp = cw_with_date.groupby('month').agg(
            count=('deal_size', 'count'),
            total_deal_size=('deal_size', 'sum')
        ).reset_index().sort_values('month')

        prev_val = None
        for _, row in mom_grp.iterrows():
            cur_val = safe_float(row['total_deal_size'])
            growth = None
            if prev_val is not None and prev_val > 0:
                growth = safe_float((cur_val - prev_val) / prev_val * 100)
            mom_performance.append({
                'month': row['month'],
                'count': safe_int(row['count']),
                'total_deal_size': cur_val,
                'growth_rate_pct': growth
            })
            prev_val = cur_val

    # ─── Forecast (deals only) ────────────────────────────────────────────────
    forecast_stages = []
    total_weighted = 0.0
    for stage, prob in STAGE_PROBABILITY.items():
        stage_rows = df[df['stage'] == stage]
        cnt = len(stage_rows)
        raw = safe_float(stage_rows['deal_size'].sum())
        weighted = safe_float(raw * prob)
        total_weighted += weighted
        forecast_stages.append({
            'stage': stage,
            'count': safe_int(cnt),
            'raw_value': raw,
            'probability': safe_float(prob),
            'weighted_value': weighted
        })

    expected_revenue = safe_float(sum(
        s['weighted_value'] for s in forecast_stages
        if s['stage'] != 'Closed Lost'
    ))

    forecast = {
        'stages': forecast_stages,
        'total_weighted': safe_float(total_weighted),
        'expected_revenue': expected_revenue,
    }

    # ─── City Heatmap (deals: Closed Won only) ────────────────────────────────
    city_df = df[df['stage'] == 'Closed Won']
    city_grp = city_df.groupby('city').agg(
        total_deal_size=('deal_size', 'sum'),
        count=('deal_size', 'count')
    ).reset_index().sort_values('total_deal_size', ascending=False)

    city_heatmap = [
        {
            'city': row['city'],
            'total_deal_size': safe_float(row['total_deal_size']),
            'count': safe_int(row['count'])
        }
        for _, row in city_grp.iterrows()
    ]

    # ─── Vehicle Category (not-lost deals + pending deployment projects) ──────
    vc_deals = df[df['stage'] != 'Closed Lost'][['vehicle_category', 'deal_size']].copy()
    vc_deals = vc_deals.rename(columns={'deal_size': '_fleet'})

    proj_pending_vc = proj[proj['status'] == 'Pending Deployment'][['vehicle_type', 'fleet_size']].copy()
    proj_pending_vc['vehicle_category'] = proj_pending_vc['vehicle_type'].apply(get_vehicle_category)
    proj_pending_vc = proj_pending_vc.rename(columns={'fleet_size': '_fleet'})[['vehicle_category', '_fleet']]

    vc_combined = pd.concat([vc_deals, proj_pending_vc], ignore_index=True)
    vc_grp = vc_combined.groupby('vehicle_category').agg(
        total_deal_size=('_fleet', 'sum'),
        count=('_fleet', 'count')
    ).reset_index().sort_values('total_deal_size', ascending=False)
    total_ds = safe_float(vc_combined['_fleet'].sum())

    vehicle_category = [
        {
            'vehicle_category': row['vehicle_category'],
            'total_deal_size': safe_float(row['total_deal_size']),
            'count': safe_int(row['count']),
            'pct': safe_float(row['total_deal_size'] / total_ds * 100 if total_ds > 0 else 0)
        }
        for _, row in vc_grp.iterrows()
    ]

    # ─── Concentration Risk (Deals not-lost + Pending Deployment projects) ───
    nl_client = ci_combined.groupby('client_name').agg(
        value=('_fleet', 'sum')
    ).reset_index().sort_values('value', ascending=False)
    nl_total = safe_float(nl_client['value'].sum())

    top5 = nl_client.head(5)
    top10 = nl_client.head(10)
    top5_val = safe_float(top5['value'].sum())
    top10_val = safe_float(top10['value'].sum())

    concentration_risk = {
        'top5_pct': safe_float(top5_val / nl_total * 100 if nl_total > 0 else 0),
        'top10_pct': safe_float(top10_val / nl_total * 100 if nl_total > 0 else 0),
        'top5_clients': [
            {
                'client_name': row['client_name'],
                'value': safe_float(row['value']),
                'pct': safe_float(row['value'] / nl_total * 100 if nl_total > 0 else 0)
            }
            for _, row in top5.iterrows()
        ],
        'top10_clients': [
            {
                'client_name': row['client_name'],
                'value': safe_float(row['value']),
                'pct': safe_float(row['value'] / nl_total * 100 if nl_total > 0 else 0)
            }
            for _, row in top10.iterrows()
        ]
    }

    # ─── Drilldown (deals only) ───────────────────────────────────────────────
    drill_grp = df.groupby(['stage', 'city', 'client_name']).agg(
        count=('deal_size', 'count'),
        total_deal_size=('deal_size', 'sum')
    ).reset_index()

    drilldown = [
        {
            'stage': row['stage'],
            'city': row['city'],
            'client_name': row['client_name'],
            'count': safe_int(row['count']),
            'total_deal_size': safe_float(row['total_deal_size'])
        }
        for _, row in drill_grp.iterrows()
    ]

    # ─── Summary Table (deals only, for filter compat) ───────────────────────
    display_df = df.copy()
    display_df['created_date'] = display_df['created_date'].apply(
        lambda x: x.strftime('%Y-%m-%d') if isinstance(x, pd.Timestamp) else ''
    )
    display_df['closed_date'] = display_df['closed_date'].apply(
        lambda x: x.strftime('%Y-%m-%d') if isinstance(x, pd.Timestamp) else ''
    )
    display_df['modified_date'] = display_df['modified_date'].apply(
        lambda x: x.strftime('%Y-%m-%d %H:%M') if isinstance(x, pd.Timestamp) else ''
    )
    display_df = display_df.fillna('')
    summary_table = display_df.to_dict(orient='records')

    # ─── Deployment Summary (projects only) ───────────────────────────────────
    depl_grp = proj.groupby('status').agg(
        count=('status', 'count'),
        fleet=('fleet_size', 'sum')
    ).reset_index()

    status_order_map = {s: i for i, s in enumerate(PROJECT_STATUS_ORDER)}
    depl_grp['_order'] = depl_grp['status'].map(
        lambda s: status_order_map.get(s, len(PROJECT_STATUS_ORDER))
    )
    depl_grp = depl_grp.sort_values('_order').drop(columns='_order')

    deployment_summary = [
        {
            'stage': row['status'],
            'count': safe_int(row['count']),
            'fleet': safe_float(row['fleet'])
        }
        for _, row in depl_grp.iterrows()
    ]

    # ─── Deployment Efficiency ────────────────────────────────────────────────
    deployed_fleet = safe_float(proj.loc[proj['status'] == 'Deployed', 'fleet_size'].sum())
    pending_fleet = safe_float(proj.loc[proj['status'] == 'Pending Deployment', 'fleet_size'].sum())
    deployment_efficiency = round(deployed_fleet / pending_fleet * 100, 1) if pending_fleet > 0 else 0.0

    # ─── Monthly Closures ─────────────────────────────────────────────────────
    # A: Closed Won deals (month = Close Date)
    # B: Non-converted Pending Deployment projects (month = Created Time)
    # Sorted: most recent month FIRST
    mc_rows = []

    cw_mc = closed_won[closed_won['closed_date'].notna()].copy()
    if len(cw_mc) > 0:
        cw_mc['month_key'] = cw_mc['closed_date'].dt.to_period('M').astype(str)
        cw_mc['month'] = cw_mc['month_key'].apply(_fmt_month_label)
        for _, row in cw_mc.iterrows():
            q = safe_float(row.get('quote', 0))
            mc_rows.append({
                'month_key': row['month_key'],
                'month': row['month'],
                'client': str(row['client_name']),
                'city': str(row.get('city', '')),
                'vehicle_type': str(row.get('vehicle_type', '')),
                'quote': q if q > 0 else None,
                'spoc': str(row['assigned_to']),
                'vehicles': safe_float(row['deal_size']),
                'source': 'Deal',
            })

    proj_mc = proj[
        (proj['status'] == 'Pending Deployment') &
        (~proj['is_converted']) &
        proj['created_date'].notna()
    ].copy()
    if len(proj_mc) > 0:
        proj_mc['month_key'] = proj_mc['created_date'].dt.to_period('M').astype(str)
        proj_mc['month'] = proj_mc['month_key'].apply(_fmt_month_label)
        for _, row in proj_mc.iterrows():
            mc_rows.append({
                'month_key': row['month_key'],
                'month': row['month'],
                'client': str(row['project_name']),
                'city': str(row.get('city', '')),
                'vehicle_type': str(row.get('vehicle_type', '')),
                'quote': None,
                'spoc': str(row['assigned_to']),
                'vehicles': safe_float(row['fleet_size']),
                'source': 'Project',
            })

    # Deduplicate: if a Deal and Project share the same client+city+vehicle_type, keep only the Deal
    deal_mc_keys = {
        (r['client'].strip().lower(), r['city'].strip().lower(), r['vehicle_type'].strip().lower())
        for r in mc_rows if r['source'] == 'Deal'
    }
    mc_rows = [
        r for r in mc_rows
        if r['source'] == 'Deal'
        or (r['client'].strip().lower(), r['city'].strip().lower(), r['vehicle_type'].strip().lower())
        not in deal_mc_keys
    ]

    # Sort: most recent month first, then by client within same month
    mc_rows.sort(key=lambda r: (r['month_key'], r['client']), reverse=True)
    monthly_closures = [{k: v for k, v in r.items() if k != 'month_key'} for r in mc_rows]

    # Monthly summary — also sorted DESC
    monthly_summary = []
    if mc_rows:
        ms_df = pd.DataFrame(mc_rows)
        ms_grp = ms_df.groupby(['month_key', 'month']).agg(
            total_deals=('client', 'count'),
            total_vehicles=('vehicles', 'sum')
        ).reset_index().sort_values('month_key', ascending=False)
        monthly_summary = [
            {
                'month': row['month'],
                'total_deals': safe_int(row['total_deals']),
                'total_vehicles': safe_float(row['total_vehicles'])
            }
            for _, row in ms_grp.iterrows()
        ]

    # ─── Combined Records (merged deals + standalone projects) ────────────────
    # Merged deals: override stage with project status, use max modified date
    # Non-merged deals: use deal stage as-is
    # Non-converted projects + unmatched converted projects: include as Project type
    deal_records = []
    for didx, row in df.iterrows():
        ts_deal = row['modified_date']
        m = row.get('margin')
        mp = row.get('margin_percent')
        client = row['org_name'] if row['org_name'] != '' else row['deal_name']
        if not client:
            client = row['deal_name'] or ''

        if didx in deal_to_proj_map:
            # Merged: use project's status as stage, take max date
            proj_idx = deal_to_proj_map[didx]
            proj_row = proj.loc[proj_idx]
            stage = proj_row['status']
            ts = _max_ts(ts_deal, proj_row['modified_date'])
        else:
            stage = row['stage']
            ts = ts_deal

        # Quote / Total Cost: only show if > 0
        q = safe_float(row['quote'])
        tc = safe_float(row['total_cost'])

        deal_records.append({
            'type': 'Deal',
            'name': row['deal_name'],
            'client': client,
            'stage': stage,
            'city': row['city'],
            'vehicle': row['vehicle_type'],
            'fleet': safe_float(row['deal_size']),
            'spoc': row['assigned_to'],
            'driver_type': row.get('driver_type', ''),
            'charging_scope': row.get('charging_scope', ''),
            'quote': q if q > 0 else None,
            'total_cost': tc if tc > 0 else None,
            'date': _fmt_date(ts),
            'date_ts': _date_ts(ts),
            'margin': round(float(m), 2) if m is not None and not (isinstance(m, float) and np.isnan(m)) else None,
            'margin_percent': round(float(mp), 2) if mp is not None and not (isinstance(mp, float) and np.isnan(mp)) else None,
        })

    proj_records = []
    for pidx, row in proj.iterrows():
        if pidx in merge_map:
            # This project was merged into a deal record — skip standalone
            continue
        ts = row['modified_date']
        proj_records.append({
            'type': 'Project',
            'name': row['project_name'],
            'client': row['project_name'],
            'stage': row['status'],
            'city': row['city'],
            'vehicle': row['vehicle_type'],
            'fleet': safe_float(row['fleet_size']),
            'spoc': row['assigned_to'],
            'driver_type': '',
            'charging_scope': '',
            'quote': None,
            'total_cost': None,
            'date': _fmt_date(ts),
            'date_ts': _date_ts(ts),
            'margin': None,
            'margin_percent': None,
        })

    combined_all = deal_records + proj_records

    # Deduplicate: if a Deal and Project share the same client+city+vehicle, keep only the Deal.
    # Compare on `client` (the organization name) — `name` often differs between deal_name and project_name
    # even when they represent the same underlying client. Also match on `name` as a fallback.
    def _combined_key(r, field):
        return (
            str(r.get(field, '')).strip().lower(),
            str(r.get('city', '')).strip().lower(),
            str(r.get('vehicle', '')).strip().lower(),
        )

    deal_client_keys = {_combined_key(r, 'client') for r in combined_all if r['type'] == 'Deal'}
    deal_name_keys   = {_combined_key(r, 'name')   for r in combined_all if r['type'] == 'Deal'}

    combined_all = [
        r for r in combined_all
        if r['type'] == 'Deal'
        or (_combined_key(r, 'client') not in deal_client_keys
            and _combined_key(r, 'name') not in deal_name_keys)
    ]

    combined_all.sort(key=lambda r: r['date_ts'], reverse=True)
    for r in combined_all:
        del r['date_ts']
    combined_records = combined_all

    # ─── Geographic & Fleet (Region → City → Client → Vehicle → Fleet) ────────
    REGION_MAP = {
        'Delhi NCR':    'North', 'Delhi':        'North', 'Gurgaon':      'North',
        'Noida':        'North', 'Sonipat':      'North', 'Farukh Nagar': 'North',
        'RON':          'North',
        'Mumbai':       'West',  'Pune':         'West',  'Ahmedabad':    'West',
        'ROW':          'West',
        'Bangalore':    'South', 'Chennai':      'South', 'Hyderabad':    'South',
        'ROS':          'South',
        'Kolkata':      'East',  'Patna':        'East',  'ROE':          'East',
    }

    def get_region(city):
        return REGION_MAP.get(str(city).strip(), 'Other')

    geo_rows = []

    # Deals: exclude Closed Lost
    for _, row in df[df['stage'] != 'Closed Lost'].iterrows():
        geo_rows.append({
            'region': get_region(row['city']),
            'city': str(row['city']),
            'client': str(row['client_name']),
            'vehicle_type': str(row['vehicle_type']),
            'vehicle_category': str(row['vehicle_category']),
            'fleet': safe_float(row['deal_size']),
            'source': 'Deal',
            'stage': str(row['stage']),
            'assigned_to': str(row['assigned_to']),
        })

    # Projects: Pending Deployment only, NOT converted from deal
    for _, row in proj[
        (proj['status'] == 'Pending Deployment') & (~proj['is_converted'])
    ].iterrows():
        geo_rows.append({
            'region': get_region(row['city']),
            'city': str(row['city']),
            'client': str(row['project_name']),
            'vehicle_type': str(row['vehicle_type']),
            'vehicle_category': get_vehicle_category(str(row['vehicle_type'])),
            'fleet': safe_float(row['fleet_size']),
            'source': 'Project',
            'stage': 'Pending Deployment',
            'assigned_to': str(row['assigned_to']),
        })

    # Sort by region, city, client for deterministic rendering
    geo_rows.sort(key=lambda r: (r['region'], r['city'], r['client']))
    geo_fleet = geo_rows
    geo_fleet_nested = _build_geo_nested(geo_rows)

    return {
        'kpis': kpis,
        'stage_summary': stage_summary,
        'projects_stage_summary': projects_stage_summary,
        'advanced_metrics': advanced_metrics,
        'top_clients': top_clients,
        'funnel': funnel_data,
        'velocity': velocity,
        'mom_performance': mom_performance,
        'forecast': forecast,
        'city_heatmap': city_heatmap,
        'vehicle_category': vehicle_category,
        'concentration_risk': concentration_risk,
        'drilldown': drilldown,
        'summary_table': summary_table,
        'deployment_summary': deployment_summary,
        'deployment_efficiency': deployment_efficiency,
        'monthly_closures': monthly_closures,
        'monthly_summary': monthly_summary,
        'combined_records': combined_records,
        'geo_fleet': geo_fleet,
        'geo_fleet_nested': geo_fleet_nested,
    }
