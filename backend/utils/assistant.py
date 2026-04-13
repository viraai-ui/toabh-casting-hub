import re
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from typing import Any

ACTIVE_STATUSES = {'NEW', 'REVIEWING', 'PROPOSED', 'NEGOTIATING', 'CONFIRMED', 'IN_PROGRESS'}
CLOSED_STATUSES = {'WON', 'LOST', 'INVOICED', 'PAID', 'COMPLETED', 'DECLINED'}
DEFAULT_SUGGESTIONS = [
    'How many castings are pending today?',
    'Show delayed castings',
    'What are this week\'s assignments?',
    'Find casting details for project Nike'
]


def _normalize_date(value: Any):
    if not value:
        return None

    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value

    text = str(value).strip()
    if not text:
        return None

    text = text.replace('Z', '+00:00')
    for parser in (datetime.fromisoformat,):
        try:
            return parser(text).date()
        except ValueError:
            pass

    for fmt in ('%Y-%m-%d', '%Y-%m-%d %H:%M:%S', '%m/%d/%Y', '%d/%m/%Y'):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue

    return None


def _row_to_casting(row):
    item = dict(row)
    assigned_team = item.get('assigned_team') or []
    item['assigned_team'] = [name.strip() for name in assigned_team if name and str(name).strip()]
    item['start_date'] = _normalize_date(item.get('shoot_date_start'))
    item['end_date'] = _normalize_date(item.get('shoot_date_end'))
    item['is_active'] = (item.get('status') or '').upper() in ACTIVE_STATUSES
    item['is_closed'] = (item.get('status') or '').upper() in CLOSED_STATUSES
    return item


def _load_castings(db):
    rows = db.execute(
        '''
        SELECT c.*
        FROM castings c
        ORDER BY c.updated_at DESC, c.created_at DESC
        '''
    ).fetchall()
    castings = [_row_to_casting(row) for row in rows]
    if not castings:
        return castings

    casting_ids = [casting['id'] for casting in castings]
    placeholders = ','.join('?' for _ in casting_ids)
    assignment_rows = db.execute(
        f'''
        SELECT ca.casting_id, tm.name
        FROM casting_assignments ca
        LEFT JOIN team_members tm ON tm.id = ca.team_member_id
        WHERE ca.casting_id IN ({placeholders})
        ORDER BY tm.name COLLATE NOCASE ASC, tm.id ASC
        ''',
        casting_ids,
    ).fetchall()

    assigned_by_casting = defaultdict(list)
    for row in assignment_rows:
        if row['name']:
            assigned_by_casting[row['casting_id']].append(row['name'])

    for casting in castings:
        casting['assigned_team'] = assigned_by_casting.get(casting['id'], [])

    return castings


def _format_money(value):
    if value is None:
        return '—'
    try:
        return f'${float(value):,.0f}'
    except (TypeError, ValueError):
        return str(value)


def _card_for_casting(casting, reason=None):
    budget_min = _format_money(casting.get('budget_min'))
    budget_max = _format_money(casting.get('budget_max'))
    subtitle_bits = [bit for bit in [casting.get('client_name'), casting.get('status')] if bit]
    meta = []
    if casting.get('start_date'):
        meta.append(f"Start {casting['start_date'].isoformat()}")
    if casting.get('end_date'):
        meta.append(f"End {casting['end_date'].isoformat()}")
    if casting.get('assigned_team'):
        meta.append('Assigned: ' + ', '.join(casting['assigned_team']))
    if budget_min != '—' or budget_max != '—':
        meta.append(f'Budget {budget_min} - {budget_max}')

    chips = [casting.get('priority') or 'NORMAL']
    if reason:
        chips.append(reason)

    return {
        'kind': 'casting',
        'id': casting.get('id'),
        'title': casting.get('project_name') or f"Casting #{casting.get('id')}",
        'subtitle': ' · '.join(subtitle_bits) or f"Casting #{casting.get('id')}",
        'meta': meta,
        'chips': chips,
    }


def _make_response(intent, answer, *, cards=None, suggestions=None, totals=None, context=None):
    return {
        'intent': intent,
        'answer': answer,
        'cards': cards or [],
        'suggestions': suggestions or DEFAULT_SUGGESTIONS,
        'totals': totals or {},
        'context': context or {},
        'generated_at': datetime.utcnow().isoformat() + 'Z',
    }


def _pending_today(castings, today):
    matches = []
    for casting in castings:
        if not casting['is_active']:
            continue
        if casting['start_date'] == today or casting['end_date'] == today:
            matches.append(casting)
    matches.sort(key=lambda item: (item['start_date'] or today, item['priority'] != 'HIGH'))

    if not matches:
        return _make_response(
            'pending_today',
            'No active castings are scheduled for today.',
            totals={'count': 0, 'date': today.isoformat()},
            context={'date': today.isoformat()},
        )

    answer = f"{len(matches)} active casting{'s' if len(matches) != 1 else ''} are scheduled for today."
    cards = [_card_for_casting(casting, 'Today') for casting in matches[:6]]
    return _make_response(
        'pending_today',
        answer,
        cards=cards,
        totals={'count': len(matches), 'date': today.isoformat()},
        context={'date': today.isoformat()},
        suggestions=['Show delayed castings', 'What are this week\'s assignments?', 'Find casting details for project Nike'],
    )


def _delayed_castings(castings, today):
    delayed = []
    for casting in castings:
        if casting['is_closed']:
            continue
        if casting['end_date'] and casting['end_date'] < today:
            delayed.append(casting)
    delayed.sort(key=lambda item: item['end_date'] or today)

    if not delayed:
        return _make_response(
            'delayed_castings',
            'Good news: there are no delayed castings right now.',
            totals={'count': 0},
            suggestions=['How many castings are pending today?', 'What are this week\'s assignments?', 'Find casting details for casting 1'],
        )

    cards = []
    for casting in delayed[:8]:
        days_late = (today - casting['end_date']).days if casting['end_date'] else 0
        cards.append(_card_for_casting(casting, f'{days_late}d late'))

    answer = f"I found {len(delayed)} delayed casting{'s' if len(delayed) != 1 else ''} with past due shoot windows."
    return _make_response(
        'delayed_castings',
        answer,
        cards=cards,
        totals={'count': len(delayed)},
        suggestions=['How many castings are pending today?', 'What are this week\'s assignments?', 'Find casting details for project Nike'],
    )


def _weekly_assignments(castings, today):
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)
    assignments = defaultdict(list)
    unassigned = []

    for casting in castings:
        if casting['is_closed']:
            continue
        start_date = casting['start_date']
        end_date = casting['end_date'] or start_date
        if not start_date and not end_date:
            continue
        if start_date and start_date > week_end:
            continue
        if end_date and end_date < week_start:
            continue
        if casting['assigned_team']:
            for person in casting['assigned_team']:
                assignments[person].append(casting)
        else:
            unassigned.append(casting)

    if not assignments and not unassigned:
        return _make_response(
            'weekly_assignments',
            'No casting assignments are scheduled for this week yet.',
            totals={'team_members': 0, 'castings': 0, 'week_start': week_start.isoformat(), 'week_end': week_end.isoformat()},
        )

    cards = []
    for person, person_castings in sorted(assignments.items(), key=lambda item: (-len(item[1]), item[0].lower())):
        status_breakdown = Counter((casting.get('status') or 'UNKNOWN') for casting in person_castings)
        cards.append({
            'kind': 'assignment',
            'title': person,
            'subtitle': f"{len(person_castings)} casting{'s' if len(person_castings) != 1 else ''} this week",
            'meta': [
                'Statuses: ' + ', '.join(f'{status} {count}' for status, count in status_breakdown.most_common(3)),
                'Projects: ' + ', '.join((casting.get('project_name') or f"#{casting.get('id')}") for casting in person_castings[:3]),
            ],
            'chips': ['This week'],
        })

    if unassigned:
        cards.append({
            'kind': 'assignment',
            'title': 'Unassigned this week',
            'subtitle': f"{len(unassigned)} casting{'s' if len(unassigned) != 1 else ''} still need an owner",
            'meta': [', '.join((casting.get('project_name') or f"#{casting.get('id')}") for casting in unassigned[:4])],
            'chips': ['Needs assignment'],
        })

    total_castings = sum(len(items) for items in assignments.values()) + len(unassigned)
    answer = f"This week covers {total_castings} scheduled assignment{'s' if total_castings != 1 else ''} across {len(assignments)} team member{'s' if len(assignments) != 1 else ''}."
    return _make_response(
        'weekly_assignments',
        answer,
        cards=cards[:8],
        totals={
            'team_members': len(assignments),
            'castings': total_castings,
            'week_start': week_start.isoformat(),
            'week_end': week_end.isoformat(),
        },
        suggestions=['Show delayed castings', 'How many castings are pending today?', 'Find casting details for project Nike'],
    )


def _clean_lookup_term(raw_query):
    query = re.sub(r'\b(find|show|lookup|look up|details|detail|for|casting|project|about|tell me|please)\b', ' ', raw_query, flags=re.IGNORECASE)
    query = re.sub(r'\s+', ' ', query).strip(' .#')
    return query


def _casting_lookup(castings, raw_query):
    id_match = re.search(r'\bcasting\s*#?\s*(\d+)\b', raw_query, flags=re.IGNORECASE)
    matches = []

    if id_match:
        target_id = int(id_match.group(1))
        matches = [casting for casting in castings if int(casting.get('id') or 0) == target_id]
    else:
        term = _clean_lookup_term(raw_query)
        if term:
            term_lower = term.lower()
            for casting in castings:
                haystacks = [
                    str(casting.get('project_name') or '').lower(),
                    str(casting.get('client_name') or '').lower(),
                    str(casting.get('client_company') or '').lower(),
                ]
                if any(term_lower in haystack for haystack in haystacks):
                    matches.append(casting)

    if not matches:
        return _make_response(
            'casting_lookup',
            'I could not find a matching casting. Try a project name, client name, or a casting ID like “casting 12”.',
            totals={'count': 0},
            suggestions=['Find casting details for casting 1', 'Find casting details for project Nike', 'Show delayed castings'],
        )

    cards = []
    for casting in matches[:5]:
        cards.append({
            **_card_for_casting(casting),
            'meta': [
                *(('Location ' + str(casting.get('location'))) for _ in [1] if casting.get('location')),
                *(('Medium ' + str(casting.get('medium'))) for _ in [1] if casting.get('medium')),
                *(('Requirements ' + str(casting.get('requirements'))) for _ in [1] if casting.get('requirements')),
                *(('Assigned: ' + ', '.join(casting.get('assigned_team') or [])) for _ in [1] if casting.get('assigned_team')),
            ] or ['No extra casting details available'],
        })

    top = matches[0]
    top_label = top.get('project_name') or f"casting #{top.get('id')}"
    top_client = top.get('client_name') or 'an unknown client'
    answer = f"I found {len(matches)} matching casting{'s' if len(matches) != 1 else ''}. The top result is {top_label} for {top_client}."
    return _make_response(
        'casting_lookup',
        answer,
        cards=cards,
        totals={'count': len(matches), 'top_match_id': top.get('id')},
        suggestions=['Show delayed castings', 'How many castings are pending today?', 'What are this week\'s assignments?'],
    )


def _overview(castings, today):
    active_count = sum(1 for casting in castings if casting['is_active'])
    delayed_count = sum(1 for casting in castings if not casting['is_closed'] and casting['end_date'] and casting['end_date'] < today)
    today_count = sum(1 for casting in castings if casting['is_active'] and (casting['start_date'] == today or casting['end_date'] == today))
    answer = f"You have {active_count} active castings, {today_count} scheduled today, and {delayed_count} delayed casting{'s' if delayed_count != 1 else ''}."
    cards = [
        {'kind': 'metric', 'title': 'Active castings', 'subtitle': str(active_count), 'meta': ['Open pipeline workload'], 'chips': ['Live']},
        {'kind': 'metric', 'title': 'Scheduled today', 'subtitle': str(today_count), 'meta': ['Ready for today’s follow-up'], 'chips': ['Today']},
        {'kind': 'metric', 'title': 'Delayed', 'subtitle': str(delayed_count), 'meta': ['Past due shoot windows'], 'chips': ['Attention']},
    ]
    return _make_response('overview', answer, cards=cards)


def query_casting_assistant(db, raw_query):
    query = (raw_query or '').strip()
    today = date.today()
    castings = _load_castings(db)

    if not query:
        return _overview(castings, today)

    normalized = query.lower()

    if any(phrase in normalized for phrase in ('pending today', 'today pending', 'today\'s pending', 'scheduled today', 'today')):
        return _pending_today(castings, today)

    if any(phrase in normalized for phrase in ('delayed', 'overdue', 'late', 'behind')):
        return _delayed_castings(castings, today)

    if any(phrase in normalized for phrase in ('weekly assignment', 'week assignment', 'this week', 'weekly workload', 'assignments')):
        return _weekly_assignments(castings, today)

    if any(phrase in normalized for phrase in ('detail', 'details', 'lookup', 'look up', 'find', 'show me', 'tell me about', 'casting #', 'project')):
        return _casting_lookup(castings, query)

    return _overview(castings, today)
