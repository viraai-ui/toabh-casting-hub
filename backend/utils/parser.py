import re
from datetime import datetime

def parse_casting_message(text):
    """Parse raw casting message text and extract structured fields."""
    
    text = text.strip()
    result = {
        'client_name': None,
        'client_company': None,
        'client_contact': None,
        'project_name': None,
        'project_type': None,
        'shoot_date_start': None,
        'shoot_date_end': None,
        'location': None,
        'medium': None,
        'usage': None,
        'budget_min': None,
        'budget_max': None,
        'requirements': None,
        'apply_to': None,
        'source': 'manual',
        'raw_text': text
    }
    
    lines = text.split('\n')
    
    # Detect format type
    is_standard_brief = 'From:' in text or 'Project:' in text
    is_casting_call = 'Casting Call' in text or 'Production' in text or 'Apply to:' in text
    is_talent_specs = bool(re.search(r'\d+[-\s]*(?:yo|year old)', text.lower()))
    
    # ---- Pattern 1: Standard Casting Brief ----
    if is_standard_brief:
        # From: Dharmendra / Rakesh Sharma Casting Team
        from_match = re.search(r'From:\s*(.+?)(?:\n|$)', text, re.IGNORECASE)
        if from_match:
            from_val = from_match.group(1).strip()
            if '/' in from_val:
                parts = from_val.split('/')
                result['client_name'] = parts[0].strip()
                result['client_company'] = parts[1].strip() if len(parts) > 1 else None
            else:
                result['client_name'] = from_val
        
        # Project: Amazon.in TVC
        project_match = re.search(r'Project:\s*(.+?)(?:\n|$)', text, re.IGNORECASE)
        if project_match:
            result['project_name'] = project_match.group(1).strip()
        
        # Shoot Date: 28th or 29th March
        date_match = re.search(r'Shoot(?:ing)?\s*Date:\s*(.+?)(?:\n|$)', text, re.IGNORECASE)
        if date_match:
            date_str = date_match.group(1).strip()
            parsed_dates = parse_date_flexible(date_str)
            if parsed_dates:
                result['shoot_date_start'] = parsed_dates[0]
                result['shoot_date_end'] = parsed_dates[1] if len(parsed_dates) > 1 else None
        
        # Location: Mumbai
        location_match = re.search(r'Location:\s*(.+?)(?:\n|$)', text, re.IGNORECASE)
        if location_match:
            result['location'] = location_match.group(1).strip()
        
        # Medium: TVC (All Medium inclusive of print)
        medium_match = re.search(r'Medium:\s*(.+?)(?:\n|$)', text, re.IGNORECASE)
        if medium_match:
            result['medium'] = medium_match.group(1).strip()
        
        # Usage: Perpetuity
        usage_match = re.search(r'Usage:\s*(.+?)(?:\n|$)', text, re.IGNORECASE)
        if usage_match:
            result['usage'] = usage_match.group(1).strip()
        
        # Requirements: Couple
        req_match = re.search(r'Requirements?:\s*(.+?)(?:\n|$)', text, re.IGNORECASE)
        if req_match:
            result['requirements'] = req_match.group(1).strip()
    
    # ---- Pattern 2: Casting Call ----
    elif is_casting_call:
        # Production - Offroad Films
        prod_match = re.search(r'Production\s*[-–]\s*(.+?)(?:\n|$)', text, re.IGNORECASE)
        if prod_match:
            result['client_company'] = prod_match.group(1).strip()
        
        # Director - Fahad Pathan
        director_match = re.search(r'Director\s*[-–]\s*(.+?)(?:\n|$)', text, re.IGNORECASE)
        if director_match:
            result['client_name'] = director_match.group(1).strip()
        
        # Product - Zilo
        product_match = re.search(r'Product\s*[-–]\s*(.+?)(?:\n|$)', text, re.IGNORECASE)
        if product_match:
            result['project_name'] = product_match.group(1).strip()
        
        # Mediums - digital and print
        mediums_match = re.search(r'Mediums?\s*[-–]\s*(.+?)(?:\n|$)', text, re.IGNORECASE)
        if mediums_match:
            result['medium'] = mediums_match.group(1).strip()
        
        # Usage - 2 years
        usage_match = re.search(r'Usage\s*[-–]\s*(.+?)(?:\n|$)', text, re.IGNORECASE)
        if usage_match:
            result['usage'] = usage_match.group(1).strip()
        
        # Budget for actors - 20k
        budget_match = re.search(r'Budget(?: for actors)?\s*[-–]?\s*(\d+)k', text, re.IGNORECASE)
        if budget_match:
            result['budget_min'] = int(budget_match.group(1)) * 1000
            result['budget_max'] = result['budget_min']
        
        # Shoot date - 26th March
        date_match = re.search(r'Shoot\s*date\s*[-–]\s*(.+?)(?:\n|$)', text, re.IGNORECASE)
        if date_match:
            parsed_dates = parse_date_flexible(date_match.group(1).strip())
            if parsed_dates:
                result['shoot_date_start'] = parsed_dates[0]
        
        # Apply to: 7045445998
        apply_match = re.search(r'Apply\s*to:\s*(\d+)', text, re.IGNORECASE)
        if apply_match:
            result['apply_to'] = '+' + apply_match.group(1)
            result['client_contact'] = result['apply_to']
    
    # ---- Pattern 3: Talent Specs ----
    elif is_talent_specs:
        # Age/Gender extraction
        age_match = re.search(r'(\d+)\s*[-–]?\s*(\d+)?\s*(?:yo|year old|y\.?o\.?)?\s*(male|female|m|f)', text, re.IGNORECASE)
        if age_match:
            result['requirements'] = text  # Keep the whole spec
        
        # Project/Brand extraction
        brand_match = re.search(r'(?:for|requirement is for)\s*([A-Za-z0-9\s\.]+(?:Digital Ad|TVC|Commercial|Ad|Film|Print))', text, re.IGNORECASE)
        if brand_match:
            result['project_name'] = brand_match.group(1).strip()
        
        # Shoot location and date
        location_date_match = re.search(r'Shoot(?:ing)?\s+(?:in\s+)?(.+?)\s+(?:on|in)\s+(\d+\w+\s+\w+)', text, re.IGNORECASE)
        if location_date_match:
            result['location'] = location_date_match.group(1).strip().rstrip(',')
            parsed_dates = parse_date_flexible(location_date_match.group(2).strip())
            if parsed_dates:
                result['shoot_date_start'] = parsed_dates[0]
    
    # ---- Common extractions ----
    
    # Extract WhatsApp numbers (10+ digits)
    whatsapp_matches = re.findall(r'(?:wa\.me\/|\+?91?[-.\s]?)?(\d{10,13})', text)
    if whatsapp_matches and not result['apply_to']:
        for num in whatsapp_matches:
            if len(num) >= 10:
                result['apply_to'] = '+' + num if not num.startswith('+') else num
                result['client_contact'] = result['apply_to']
                break
    
    # Extract budget (various formats: 20k, 2 lakhs, $2000, Rs. 50000)
    budget_patterns = [
        (r'(\d+)k\s*(?:non-?\s*negotiable)?', lambda m: int(m.group(1)) * 1000),
        (r'Rs\.?\s*(\d+(?:,\d+)*)', lambda m: int(m.group(1).replace(',', ''))),
        (r'\$(\d+)', lambda m: int(m.group(1))),
        (r'(\d+(?:,\d+)*)\s*lakh', lambda m: int(m.group(1).replace(',', '')) * 100000),
    ]
    
    for pattern, converter in budget_patterns:
        budget_match = re.search(pattern, text, re.IGNORECASE)
        if budget_match:
            amount = converter(budget_match)
            if result['budget_min'] is None:
                result['budget_min'] = amount
                result['budget_max'] = amount
            break
    
    # Extract location if not found yet
    if not result['location']:
        location_patterns = [
            r'Location[:\s]+([A-Za-z\s]+?)(?:\n|,|$)',
            r'in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:on|at|by)',
            r'Shoot(?:ing)?\s+in\s+([A-Za-z\s]+?)\s+on',
        ]
        for pattern in location_patterns:
            loc_match = re.search(pattern, text)
            if loc_match:
                result['location'] = loc_match.group(1).strip()
                break
    
    # Determine medium if not found
    if not result['medium']:
        medium_lower = text.lower()
        if 'tv' in medium_lower or 'tvc' in medium_lower:
            result['medium'] = 'TVC'
        if 'print' in medium_lower:
            result['medium'] = 'Print' if not result['medium'] else f"{result['medium']} + Print"
        if 'digital' in medium_lower:
            result['medium'] = 'Digital' if not result['medium'] else f"{result['medium']} + Digital"
    
    return result


def parse_date_flexible(date_str):
    """Parse various date formats and return list of date strings."""
    date_str = date_str.strip().lower()
    dates = []
    
    # Month mapping
    months = {
        'jan': '01', 'january': '01',
        'feb': '02', 'february': '02',
        'mar': '03', 'march': '03',
        'apr': '04', 'april': '04',
        'may': '05',
        'jun': '06', 'june': '06',
        'jul': '07', 'july': '07',
        'aug': '08', 'august': '08',
        'sep': '09', 'september': '09',
        'oct': '10', 'october': '10',
        'nov': '11', 'november': '11',
        'dec': '12', 'december': '12',
    }
    
    now = datetime.now()
    current_year = now.year

    if date_str in {'today', 'tdy'}:
        return [now.strftime('%Y-%m-%d')]
    if date_str in {'tomorrow', 'tmrw', 'tmr'}:
        from datetime import timedelta
        return [(now + timedelta(days=1)).strftime('%Y-%m-%d')]
    
    # Pattern: "28th or 29th March"
    or_match = re.match(r'(\d+)(?:st|nd|rd|th)?\s*(?:or|and)?\s*(\d+)?\s*(?:st|nd|rd|th)?\s*(\w+)', date_str)
    if or_match:
        day1 = int(or_match.group(1))
        day2 = int(or_match.group(2)) if or_match.group(2) else day1
        month_name = or_match.group(3).lower()
        if month_name in months:
            month = months[month_name]
            dates.append(f'{current_year}-{month}-{day1:02d}')
            if day2 != day1:
                dates.append(f'{current_year}-{month}-{day2:02d}')
        return dates
    
    # Pattern: "26th March" or "24th March"
    single_match = re.match(r'(\d+)(?:st|nd|rd|th)?\s*(\w+)', date_str)
    if single_match:
        day = int(single_match.group(1))
        month_name = single_match.group(2).lower()[:3]
        if month_name in months:
            month = months[month_name]
            dates.append(f'{current_year}-{month}-{day:02d}')
        return dates
    
    # Pattern: "March 28" or "28 March"
    month_day_match = re.match(r'(\w+)\s+(\d+)|(\d+)\s+(\w+)', date_str)
    if month_day_match:
        if month_day_match.group(1):
            month_name = month_day_match.group(1).lower()[:3]
            day = int(month_day_match.group(2))
        else:
            month_name = month_day_match.group(4).lower()[:3]
            day = int(month_day_match.group(3))
        if month_name in months:
            month = months[month_name]
            dates.append(f'{current_year}-{month}-{day:02d}')
        return dates
    
    # Pattern: ISO-like "2024-03-28"
    iso_match = re.match(r'(\d{4})[-/](\d{1,2})[-/](\d{1,2})', date_str)
    if iso_match:
        dates.append(f'{iso_match.group(1)}-{iso_match.group(2).zfill(2)}-{iso_match.group(3).zfill(2)}')
        return dates
    
    return dates
