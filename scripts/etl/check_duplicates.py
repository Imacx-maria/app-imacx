# -*- coding: utf-8 -*-
"""
Diagnostic script to check for duplicate records in PHC tables
Checks for:
1. Duplicate primary keys (document_id, line_id, etc.)
2. Missing primary key constraints
3. Duplicate business keys (document_number + document_type + year)
"""

import sys
import os
from pathlib import Path
from dotenv import load_dotenv
import psycopg2
from datetime import datetime

# Set UTF-8 encoding for Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Load environment variables
PROJECT_ROOT = Path(__file__).resolve().parents[2]
env_paths = [PROJECT_ROOT / ".env.local", PROJECT_ROOT / ".env"]
for env_path in env_paths:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        break
else:
    load_dotenv()

# Table configurations
TABLES_CONFIG = {
    'bo': {
        'primary_key': 'document_id',
        'business_keys': ['document_number', 'document_type', 'document_date'],
        'has_year_rule': True
    },
    'bi': {
        'primary_key': 'line_id',
        'business_keys': None,
        'has_year_rule': False,
        'check_business_keys': False  # Line table - can have duplicates
    },
    'ft': {
        'primary_key': 'invoice_id',
        'business_keys': ['invoice_number', 'invoice_date', 'document_type'],
        'has_year_rule': False,
        'check_business_keys': True  # Main table - check for duplicates
    },
    'fi': {
        'primary_key': 'line_item_id',
        'business_keys': None,
        'has_year_rule': False,
        'check_business_keys': False  # Line table - can have duplicates
    },
    'fo': {
        'primary_key': 'document_id',
        'business_keys': ['internal_document_number', 'document_date'],
        'has_year_rule': False,
        'check_business_keys': True  # Main table - check for duplicates
    }
}

def get_supabase_connection():
    """Connect to Supabase PostgreSQL"""
    try:
        conn = psycopg2.connect(
            host=os.getenv("PG_HOST"),
            dbname=os.getenv("PG_DB"),
            user=os.getenv("PG_USER"),
            password=os.getenv("PG_PASSWORD"),
            port=os.getenv("PG_PORT", "5432")
        )
        return conn
    except Exception as e:
        print(f"❌ Supabase connection failed: {e}")
        sys.exit(1)

def check_primary_key_constraint(cursor, table_name, primary_key):
    """Check if primary key constraint exists"""
    query = """
    SELECT tc.constraint_name, tc.constraint_type
    FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'phc'
      AND tc.table_name = %s
      AND tc.constraint_type = 'PRIMARY KEY'
    """
    cursor.execute(query, (table_name,))
    result = cursor.fetchone()
    return result is not None

def check_duplicate_primary_keys(cursor, table_name, primary_key):
    """Check for duplicate primary key values"""
    query = f"""
    SELECT "{primary_key}", COUNT(*) as count
    FROM phc."{table_name}"
    GROUP BY "{primary_key}"
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 20
    """
    cursor.execute(query)
    return cursor.fetchall()

def check_duplicate_business_keys(cursor, table_name, keys, primary_key):
    """Check for duplicate business keys (for main tables ft, fo)"""
    # Build GROUP BY clause for all business key columns
    group_by_cols = ', '.join([f'"{key}"' for key in keys])
    select_cols = ', '.join([f'"{key}"' for key in keys])

    query = f"""
    SELECT
        {select_cols},
        COUNT(*) as count,
        STRING_AGG(DISTINCT "{primary_key}"::text, ', ') as pk_ids
    FROM phc."{table_name}"
    GROUP BY {group_by_cols}
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 20
    """
    cursor.execute(query)
    return cursor.fetchall()

def check_duplicate_business_keys_with_year(cursor, table_name, keys):
    """Check for duplicate business keys within same year"""
    # For BO: document_number + document_type + year(document_date)
    query = f"""
    SELECT
        "{keys[0]}" as doc_num,
        "{keys[1]}" as doc_type,
        EXTRACT(YEAR FROM "{keys[2]}") as year,
        COUNT(*) as count,
        STRING_AGG(DISTINCT document_id::text, ', ') as document_ids
    FROM phc."{table_name}"
    GROUP BY "{keys[0]}", "{keys[1]}", EXTRACT(YEAR FROM "{keys[2]}")
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 20
    """
    cursor.execute(query)
    return cursor.fetchall()

def get_table_row_count(cursor, table_name):
    """Get total row count for a table"""
    query = f'SELECT COUNT(*) FROM phc."{table_name}"'
    cursor.execute(query)
    return cursor.fetchone()[0]

def get_sample_duplicates(cursor, table_name, primary_key, duplicate_value):
    """Get sample records with duplicate primary key"""
    query = f"""
    SELECT *
    FROM phc."{table_name}"
    WHERE "{primary_key}" = %s
    LIMIT 5
    """
    cursor.execute(query, (duplicate_value,))
    return cursor.fetchall()

def main():
    print("=" * 100)
    print("PHC TABLES DUPLICATE DETECTION REPORT")
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 100)

    conn = get_supabase_connection()
    print("✅ Connected to Supabase\n")

    cursor = conn.cursor()

    total_issues = 0

    for table_name, config in TABLES_CONFIG.items():
        print("\n" + "=" * 100)
        print(f"TABLE: phc.{table_name}")
        print("=" * 100)

        # Check if table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'phc' AND table_name = %s
            )
        """, (table_name,))

        if not cursor.fetchone()[0]:
            print(f"⚠️  Table does not exist - skipping")
            continue

        # Get row count
        row_count = get_table_row_count(cursor, table_name)
        print(f"\n📊 Total records: {row_count:,}")

        # 1. Check Primary Key Constraint
        print(f"\n🔑 PRIMARY KEY CONSTRAINT CHECK:")
        print("-" * 100)
        primary_key = config['primary_key']
        has_pk_constraint = check_primary_key_constraint(cursor, table_name, primary_key)

        if has_pk_constraint:
            print(f"✅ Primary key constraint EXISTS on '{primary_key}'")
        else:
            print(f"❌ PRIMARY KEY CONSTRAINT MISSING on '{primary_key}'")
            total_issues += 1

        # 2. Check for Duplicate Primary Keys
        print(f"\n🔍 DUPLICATE PRIMARY KEY CHECK:")
        print("-" * 100)
        duplicates = check_duplicate_primary_keys(cursor, table_name, primary_key)

        if duplicates:
            print(f"❌ Found {len(duplicates)} unique values with duplicates:\n")
            total_issues += len(duplicates)

            for dup in duplicates[:10]:  # Show first 10
                pk_value, count = dup
                print(f"  {primary_key} = '{pk_value}' → {count} occurrences")

                # Show sample records
                samples = get_sample_duplicates(cursor, table_name, primary_key, pk_value)
                if samples and len(samples) > 0:
                    columns = [desc[0] for desc in cursor.description]
                    print(f"    Sample records:")
                    for sample in samples[:3]:
                        # Show first few columns
                        display_cols = dict(zip(columns[:5], sample[:5]))
                        print(f"      {display_cols}")
                print()

            if len(duplicates) > 10:
                print(f"  ... and {len(duplicates) - 10} more duplicate values")
        else:
            print(f"✅ No duplicate primary keys found")

        # 3. Check for Duplicate Business Keys (if applicable)
        if config['has_year_rule'] and config['business_keys']:
            print(f"\n📋 DUPLICATE BUSINESS KEY CHECK (same year):")
            print("-" * 100)
            print(f"  Checking: {' + '.join(config['business_keys'])} within same year")

            biz_duplicates = check_duplicate_business_keys_with_year(
                cursor, table_name, config['business_keys']
            )

            if biz_duplicates:
                print(f"\n❌ Found {len(biz_duplicates)} business key combinations with duplicates:\n")
                total_issues += len(biz_duplicates)

                for dup in biz_duplicates[:10]:
                    doc_num, doc_type, year, count, doc_ids = dup
                    print(f"  Document #{doc_num} ({doc_type}) Year {int(year)} → {count} occurrences")
                    print(f"    document_ids: {doc_ids}")
                    print()

                if len(biz_duplicates) > 10:
                    print(f"  ... and {len(biz_duplicates) - 10} more duplicates")
            else:
                print(f"✅ No duplicate business keys found")

        # Check for general business key duplicates (for main tables like ft, fo)
        elif config.get('check_business_keys') and config['business_keys']:
            print(f"\n📋 DUPLICATE BUSINESS KEY CHECK:")
            print("-" * 100)
            print(f"  Checking: {' + '.join(config['business_keys'])} (main table)")

            biz_duplicates = check_duplicate_business_keys(
                cursor, table_name, config['business_keys'], primary_key
            )

            if biz_duplicates:
                # Check if all duplicates have NULL in first key column
                null_duplicates = sum(1 for dup in biz_duplicates if dup[0] is None)

                if null_duplicates == len(biz_duplicates):
                    print(f"\n⚠️  Found {len(biz_duplicates)} business key combinations with NULL values:\n")
                    print(f"  Note: These are NOT true duplicates - different records with NULL business keys")
                    print(f"  This is expected for documents without assigned {config['business_keys'][0]}\n")
                else:
                    print(f"\n❌ Found {len(biz_duplicates)} business key combinations with duplicates:\n")
                    total_issues += len(biz_duplicates)

                for dup in biz_duplicates[:10]:
                    # Last two items are count and pk_ids
                    count = dup[-2]
                    pk_ids = dup[-1]
                    # First items are the business key values
                    key_values = dup[:-2]
                    keys_display = ', '.join([f"{k}={v}" for k, v in zip(config['business_keys'], key_values)])
                    print(f"  {keys_display} → {count} occurrences")
                    # Only show first 5 IDs if many
                    if count > 5:
                        pk_ids_list = pk_ids.split(', ')
                        pk_ids = ', '.join(pk_ids_list[:5]) + f", ... ({count - 5} more)"
                    print(f"    {primary_key}s: {pk_ids}")
                    print()

                if len(biz_duplicates) > 10:
                    print(f"  ... and {len(biz_duplicates) - 10} more duplicates")
            else:
                print(f"✅ No duplicate business keys found")

    # Summary
    print("\n" + "=" * 100)
    print("SUMMARY")
    print("=" * 100)

    if total_issues == 0:
        print("✅ All checks passed! No duplicates or missing constraints found.")
    else:
        print(f"❌ Found {total_issues} issues that need attention")
        print("\nRECOMMENDATIONS:")
        print("1. Run migration to remove duplicate records")
        print("2. Add missing primary key constraints")
        print("3. Add business rule unique constraints where applicable")
        print("4. Fix ETL code to prevent future duplicates")

    conn.close()
    print("\n✅ Done!\n")

if __name__ == "__main__":
    main()
