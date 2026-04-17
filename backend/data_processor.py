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


def _fmt_month_label(period_str):
    """Convert '2026-04' to 'Apr-26'."""
    try:
        dt = datetime.strptime(period_str, '%Y-%m')
        return dt.strftime('%b-%y')
    except Exception:
        return period_str


def process_csvs(deals_bytes, projects_bytes):
    # ─── Read CSVs ────────────────────────────────────────────────────────────
    deals_raw = pd.read_csv(io.BytesIO(deals_bytes))
    projects_raw = pd.read_csv(io.BytesIO(projects_bytes))

    # ─── Normalize Deals ──────────────────────────────────────────────────────
    deals_rename = {}
    col_map_deals = {
        'Deal Name': 'deal_name',
        'Organization Name': 'org_name',
        'Sales Stage': 'stage',
        'City': 'city',
        'Vehicle Type': 'vehicle_type',
        'Deal Size': 'deal_size',
        'Assigned To': 'assigned_to',
        'Close Date': 'closed_date',
        'Modified Time': 'modified_date',
        'Created Time': 'created_date',
        'Quote': 'quote',
        'Total Cost': 'total_cost',
    }
    for orig, new in col_map_deals.items():
        if orig in deals_raw.columns:
            deals_rename[orig] = new
    df = deals_raw.rename(columns=deals_rename).copy()

    # Ensure all expected deal columns exist
    for col in ['deal_name', 'org_name', 'stage', 'city', 'vehicle_type',
                'deal_size', 'assigned_to', 'closed_date', 'modified_date', 'created_date',
                'quote', 'total_cost']:
        if col not in df.columns:
            df[col] = None

    # Parse numeric / date columns for deals
    df['deal_size'] = df['deal_size'].apply(parse_deal_size)
    df['quote'] = df['quote'].apply(parse_deal_size)
    df['total_cost'] = df['total_cost'].apply(parse_deal_size)
    df['created_date'] = df['created_date'].apply(parse_date)
    df['closed_date'] = df['closed_date'].apply(parse_date)
    df['modified_date'] = df['modified_date'].apply(parse_date)

    # Per-deal margin: only where quote > 0 and total_cost is valid
    margin_mask = (df['quote'] > 0) & (df['total_cost'] > 0)
    df['margin'] = None
    df['margin_percent'] = None
    df.loc[margin_mask, 'margin'] = df.loc[margin_mask, 'quote'] - df.loc[margin_mask, 'total_cost']
    df.loc[margin_mask, 'margin_percent'] = (
        df.loc[margin_mask, 'margin'] / df.loc[margin_mask, 'quote'] * 100
    )
    valid_margin = df[df['margin_percent'].notna()]['margin_percent']
    avg_margin_percent = safe_float(valid_margin.mean() if len(valid_margin) > 0 else 0)

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

    df = df.reset_index(drop=True)

    # ─── Normalize Projects ───────────────────────────────────────────────────
    proj_rename = {}
    col_map_projects = {
        'Project Name': 'project_name',
        'Status': 'status',
        'City': 'city',
        'Vehicle Type': 'vehicle_type',
        'Fleet Size': 'fleet_size',
        'Assigned To': 'assigned_to',
        'Modified Time': 'modified_date',
        'Created Time': 'created_date',
        'Target End Date': 'target_end_date',
        'Is Converted From Deal': 'is_converted_from_deal',
    }
    for orig, new in col_map_projects.items():
        if orig in projects_raw.columns:
            proj_rename[orig] = new
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

    # ─── Computed deal subsets ────────────────────────────────────────────────
    closed_won = df[df['stage'] == 'Closed Won']
    not_lost = df[df['stage'] != 'Closed Lost']

    # ─── KPIs ────────────────────────────────────────────────────────────────
    # total_opps: deals + non-converted projects (no double-counting)
    proj_not_converted_count = int((~proj['is_converted']).sum())
    total_opps = len(df) + proj_not_converted_count

    # pipeline_value: not-lost deals + non-converted pending deployment projects
    proj_pending_new = proj[
        (proj['status'] == 'Pending Deployment') & (~proj['is_converted'])
    ]
    pipeline_value = safe_float(not_lost['deal_size'].sum()) + safe_float(proj_pending_new['fleet_size'].sum())

    closed_won_value = safe_float(closed_won['deal_size'].sum())

    # total_pending_deployment: sum of ALL pending projects fleet (not just non-converted)
    pending_value = safe_float(proj[proj['status'] == 'Pending Deployment']['fleet_size'].sum())

    positive_deals = df[df['deal_size'] > 0]['deal_size']
    avg_deal_size = safe_float(positive_deals.mean() if len(positive_deals) > 0 else 0)
    win_rate = safe_float(len(closed_won) / total_opps * 100 if total_opps > 0 else 0)

    # Closed won in last 90 days
    now = pd.Timestamp.now()
    ninety_ago = now - pd.Timedelta(days=90)
    closed_last_90 = closed_won[
        closed_won['closed_date'].notna() &
        (closed_won['closed_date'] >= ninety_ago)
    ]['deal_size'].sum()
    pipeline_coverage = safe_float(pipeline_value / closed_last_90 if closed_last_90 > 0 else 0)

    # avg_tat_days: Close Date - Created Time for Closed Won deals only
    cw_tat = closed_won[closed_won['created_date'].notna() & closed_won['closed_date'].notna()].copy()
    cw_tat['tat_days'] = (cw_tat['closed_date'] - cw_tat['created_date']).dt.days.clip(lower=0)
    avg_tat_days = safe_float(cw_tat['tat_days'].mean() if len(cw_tat) > 0 else 0)

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

    # ─── Stage Summary (deals only) ───────────────────────────────────────────
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

    # ─── Top Clients (deals only, uses org_name / deal_name) ─────────────────
    top_clients_df = not_lost.groupby('client_name').agg(
        total_deal_size=('deal_size', 'sum'),
        count=('deal_size', 'count'),
        avg_deal_size=('deal_size', 'mean')
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
        # Only apply to deal stages that exist in df
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

    # ─── Vehicle Category (deals not-lost + pending projects) ────────────────
    # Deals (not Closed Lost)
    vc_deals = df[df['stage'] != 'Closed Lost'][['vehicle_category', 'deal_size']].copy()
    vc_deals = vc_deals.rename(columns={'deal_size': '_fleet'})

    # Projects in Pending Deployment
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

    # ─── Concentration Risk (deals only, uses org_name / deal_name) ──────────
    nl_client = not_lost.groupby('client_name').agg(
        value=('deal_size', 'sum')
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

    # ─── Summary Table (deals only) ───────────────────────────────────────────
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

    # ─── Deployment Efficiency (projects only) ────────────────────────────────
    deployed_fleet = safe_float(proj.loc[proj['status'] == 'Deployed', 'fleet_size'].sum())
    pending_fleet = safe_float(proj.loc[proj['status'] == 'Pending Deployment', 'fleet_size'].sum())
    deployment_efficiency = round(deployed_fleet / pending_fleet * 100, 1) if pending_fleet > 0 else 0.0

    # ─── Monthly Closures (Deals: Closed Won + Projects: Pending, not converted) ──
    mc_rows = []

    # Source A: Closed Won deals with Close Date
    cw_mc = closed_won[closed_won['closed_date'].notna()].copy()
    if len(cw_mc) > 0:
        cw_mc['month_key'] = cw_mc['closed_date'].dt.to_period('M').astype(str)
        cw_mc['month'] = cw_mc['month_key'].apply(_fmt_month_label)
        cw_grp = cw_mc.groupby(['month_key', 'month', 'client_name', 'assigned_to'], dropna=False).agg(
            vehicles=('deal_size', 'sum')
        ).reset_index()
        for _, row in cw_grp.iterrows():
            mc_rows.append({
                'month_key': row['month_key'],
                'month': row['month'],
                'client': str(row['client_name']),
                'spoc': str(row['assigned_to']),
                'vehicles': safe_float(row['vehicles']),
                'source': 'Deal',
            })

    # Source B: Projects where status == Pending Deployment AND is_converted == False
    proj_mc = proj[
        (proj['status'] == 'Pending Deployment') &
        (~proj['is_converted']) &
        proj['created_date'].notna()
    ].copy()
    if len(proj_mc) > 0:
        proj_mc['month_key'] = proj_mc['created_date'].dt.to_period('M').astype(str)
        proj_mc['month'] = proj_mc['month_key'].apply(_fmt_month_label)
        proj_grp = proj_mc.groupby(['month_key', 'month', 'project_name', 'assigned_to'], dropna=False).agg(
            vehicles=('fleet_size', 'sum')
        ).reset_index()
        for _, row in proj_grp.iterrows():
            mc_rows.append({
                'month_key': row['month_key'],
                'month': row['month'],
                'client': str(row['project_name']),
                'spoc': str(row['assigned_to']),
                'vehicles': safe_float(row['vehicles']),
                'source': 'Project',
            })

    # Sort by month_key asc, then client
    mc_rows.sort(key=lambda r: (r['month_key'], r['client']))
    monthly_closures = [{k: v for k, v in r.items() if k != 'month_key'} for r in mc_rows]

    # Monthly summary
    monthly_summary = []
    if monthly_closures:
        ms_df = pd.DataFrame(mc_rows)
        ms_grp = ms_df.groupby(['month_key', 'month']).agg(
            total_deals=('client', 'count'),
            total_vehicles=('vehicles', 'sum')
        ).reset_index().sort_values('month_key')
        monthly_summary = [
            {
                'month': row['month'],
                'total_deals': safe_int(row['total_deals']),
                'total_vehicles': safe_float(row['total_vehicles'])
            }
            for _, row in ms_grp.iterrows()
        ]

    # ─── Combined Records (deals + projects) ──────────────────────────────────
    deal_records = []
    for _, row in df.iterrows():
        client = row['org_name'] if row['org_name'] != '' else row['deal_name']
        if not client:
            client = row['deal_name'] or ''
        ts = row['modified_date']
        m = row.get('margin')
        mp = row.get('margin_percent')
        deal_records.append({
            'type': 'Deal',
            'name': row['deal_name'],
            'client': client,
            'stage': row['stage'],
            'city': row['city'],
            'vehicle': row['vehicle_type'],
            'fleet': safe_float(row['deal_size']),
            'spoc': row['assigned_to'],
            'date': _fmt_date(ts),
            'date_ts': _date_ts(ts),
            'margin': round(float(m), 2) if m is not None and not (isinstance(m, float) and np.isnan(m)) else None,
            'margin_percent': round(float(mp), 2) if mp is not None and not (isinstance(mp, float) and np.isnan(mp)) else None,
        })

    proj_records = []
    for _, row in proj.iterrows():
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
            'date': _fmt_date(ts),
            'date_ts': _date_ts(ts),
            'margin': None,
            'margin_percent': None,
        })

    combined_all = deal_records + proj_records
    combined_all.sort(key=lambda r: r['date_ts'], reverse=True)
    for r in combined_all:
        del r['date_ts']
    combined_records = combined_all

    return {
        'kpis': kpis,
        'stage_summary': stage_summary,
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
    }
