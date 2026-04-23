#!/usr/bin/env python3
"""
Categorize H1B companies by industry using NAICS codes and name patterns.
"""

import csv
import re
import unicodedata
from collections import defaultdict

INPUT_FILE = "/Users/asshvinkumar/Downloads/h1b_datahubexport-2023.csv"
OUTPUT_DIR = "/Users/asshvinkumar/career-ops/data/h1b-categories"

# NAICS code ranges for categories
NAICS_CATEGORIES = {
    "Technology": (51, 51),  # 51 - Software, IT, Telecom
    "Manufacturing": (31, 33),  # 31-33 - Industrial, Electronics, Auto, Pharma
    "Healthcare": (62, 62),  # 62 - Hospitals, Medical, Biotech
    "Financial": (52, 52),  # 52 - Banks, Insurance, Investment
    "Professional Services": (54, 54),  # 54 - Consulting, Legal, Accounting
    "Retail & E-commerce": (44, 45),  # 44-45 - Stores, Online Retail
    "Transportation": (48, 49),  # 48-49 - Logistics, Auto services
    "Energy": (22, 22),  # 22 - Oil, Gas, Renewables
    "Real Estate": (53, 53),  # 53 - Property management
    "Education": (61, 61),  # 61 - Schools, Universities
    "Agriculture": (11, 21),  # 11 - Farming, 21 - Mining
    "Construction": (23, 23),  # 23 - Building, Engineering
    "Hospitality": (72, 72),  # 72 - Hotels, Restaurants
    "Wholesale Trade": (42, 42),  # 42 - Distributors
}

# Name patterns for additional categorization (for NAICS 51 that aren't tech)
MEDIA_KEYWORDS = [
    "media", "entertainment", "gaming", "publishing", "broadcast", "film", "video",
    "news", "digital content", "streaming", "television", "radio", "music", "podcast"
]

TECH_KEYWORDS = [
    "software", "tech", "it ", " systems", " solutions", " digital", " cloud",
    " data", " network", " computer", " ai ", " artificial", " machine learning",
    " cyber", " security", " internet", " web ", " app ", " mobile", " saas",
    " platform", " api ", " semiconductor", " chip", " electronic", " robotics",
    " automation", " telecom", " wireless", " broadband", " fiber", " e-commerce",
    " online", " internet", " search", " social", " video", " streaming", " gaming"
]

def get_category_from_naics(naics_str, employer_name):
    """Get category from NAICS code and employer name."""
    try:
        naics = int(naics_str) if naics_str else 0
    except (ValueError, TypeError):
        return "Other"

    # Check each category range
    for category, (start, end) in NAICS_CATEGORIES.items():
        if start <= naics <= end:
            # For NAICS 51, need to differentiate between tech and media
            if naics == 51:
                name_lower = employer_name.lower() if employer_name else ""
                # Check for media keywords
                for keyword in MEDIA_KEYWORDS:
                    if keyword in name_lower:
                        return "Media & Entertainment"
                # Default to Technology for NAICS 51
                return "Technology"
            return category

    # Default categories based on NAICS
    if naics == 51:
        return "Technology"
    elif 31 <= naics <= 33:
        return "Manufacturing"
    elif naics == 62:
        return "Healthcare"
    elif naics == 52:
        return "Financial"
    elif naics == 54:
        return "Professional Services"
    elif 44 <= naics <= 45:
        return "Retail & E-commerce"
    elif 48 <= naics <= 49:
        return "Transportation"
    elif naics == 22:
        return "Energy"
    elif naics == 53:
        return "Real Estate"
    elif naics == 61:
        return "Education"
    elif naics == 11 or naics == 21:
        return "Agriculture"
    elif naics == 23:
        return "Construction"
    elif naics == 72:
        return "Hospitality"
    elif naics == 42:
        return "Wholesale Trade"

    return "Other"

def normalize_employer_name(name):
    """Normalize employer name for URL generation."""
    if not name:
        return ""

    # Remove common suffixes
    suffixes = [
        r'\s+L\.L\.C\.?$', r'\s+Inc\.?$', r'\s+Corp\.?$', r'\s+Ltd\.?$',
        r'\s+LLP$', r'\s+LP$', r'\s+PLC$', r'\s+Co\.?$', r'\s+Company$',
        r'\s+Corp$', r'\s+International$', r'\s+International Inc$',
        r'\s+Technologies$', r'\s+Technology$', r'\s+Services$', r'\s+Group$',
        r'\s+Holdings$', r'\s+Partners$', r'\s+Solutions$', r'\s+America$',
        r'\s+USA$', r'\s+US$', r'\s+Inc$', r'\s+LLC$', r'\s+Ltd$',
        r'\s+PA$', r'\s+PC$', r'\s+PLLC$', r'\s+PC$',
    ]

    normalized = name
    for suffix in suffixes:
        normalized = re.sub(suffix, '', normalized, flags=re.IGNORECASE)

    # Remove punctuation and convert to lowercase
    normalized = re.sub(r'[^\w\s-]', '', normalized)
    normalized = normalized.lower().strip()
    normalized = re.sub(r'\s+', '-', normalized)

    return normalized

def generate_careers_url(employer_name):
    """Generate plausible career page URLs."""
    normalized = normalize_employer_name(employer_name)
    if not normalized:
        return ""

    urls = []

    # Try different URL patterns
    patterns = [
        f"https://careers.{normalized}.com",
        f"https://jobs.{normalized}.com",
        f"https://www.{normalized}.com/careers",
        f"https://job-boards.greenhouse.io/{normalized}",
        f"https://jobs.ashbyhq.com/{normalized}",
        f"https://{normalized}.easyapply.co",
    ]

    # Add first valid-looking URL
    for url in patterns:
        if len(normalized) > 2:
            urls.append(url)
            break

    return urls[0] if urls else ""

def main():
    # Track unique employers
    employers = {}  # employer_name -> {state, city, naics, category}

    print(f"Reading {INPUT_FILE}...")

    with open(INPUT_FILE, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f)
        for row in reader:
            employer = row.get('Employer', '').strip()
            if not employer:
                continue

            naics = row.get('NAICS', '')
            state = row.get('State', '')
            city = row.get('City', '')

            # Get category
            category = get_category_from_naics(naics, employer)

            # Store employer info (use first occurrence)
            if employer not in employers:
                employers[employer] = {
                    'state': state,
                    'city': city,
                    'naics': naics,
                    'category': category
                }

    print(f"Found {len(employers)} unique employers")

    # Write all companies file
    all_file = f"{OUTPUT_DIR}/h1b-all-companies.tsv"
    with open(all_file, 'w', encoding='utf-8') as f:
        f.write("employer\tstate\tcity\tnaics\tcategory\tcareers_url\n")
        for employer, info in sorted(employers.items()):
            careers_url = generate_careers_url(employer)
            f.write(f"{employer}\t{info['state']}\t{info['city']}\t{info['naics']}\t{info['category']}\t{careers_url}\n")

    print(f"Written {all_file}")

    # Create categorized files
    categories = {
        "Technology": "h1b-tech.tsv",
        "Manufacturing": "h1b-manufacturing.tsv",
        "Healthcare": "h1b-healthcare.tsv",
        "Financial": "h1b-financial.tsv",
        "Professional Services": "h1b-professional.tsv",
        "Retail & E-commerce": "h1b-retail.tsv",
        "Media & Entertainment": "h1b-media.tsv",
        "Transportation": "h1b-transportation.tsv",
        "Energy": "h1b-energy.tsv",
        "Real Estate": "h1b-realestate.tsv",
        "Education": "h1b-education.tsv",
        "Agriculture": "h1b-agriculture.tsv",
        "Construction": "h1b-construction.tsv",
        "Hospitality": "h1b-hospitality.tsv",
        "Wholesale Trade": "h1b-wholesale.tsv",
        "Other": "h1b-uncategorized.tsv"
    }

    # Initialize category files
    category_files = {}
    for category, filename in categories.items():
        filepath = f"{OUTPUT_DIR}/{filename}"
        category_files[category] = open(filepath, 'w', encoding='utf-8')
        category_files[category].write("employer\tstate\tcity\tnaics\tcategory\tcareers_url\n")

    # Write to category files
    for employer, info in sorted(employers.items()):
        category = info['category']
        careers_url = generate_careers_url(employer)
        if category in category_files:
            category_files[category].write(
                f"{employer}\t{info['state']}\t{info['city']}\t{info['naics']}\t{info['category']}\t{careers_url}\n"
            )

    # Close all files and print summary
    for category, f in category_files.items():
        f.close()

    # Print counts
    print("\nCategory counts:")
    for category, filename in sorted(categories.items()):
        filepath = f"{OUTPUT_DIR}/{filename}"
        with open(filepath, 'r') as f:
            count = sum(1 for line in f) - 1  # subtract header
        print(f"  {category}: {count}")

    print(f"\nTotal categorized: {sum(1 for _, info in employers.items())}")

if __name__ == "__main__":
    main()
