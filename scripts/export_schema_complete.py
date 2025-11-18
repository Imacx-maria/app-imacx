#!/usr/bin/env python3
"""
Complete schema export using psycopg2 and information_schema queries
"""
import os
import sys
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
BASE_DIR = Path(__file__).resolve().parent.parent
ENV_CANDIDATES = [
    BASE_DIR / ".env.local",
    BASE_DIR / ".env",
]

for env_path in ENV_CANDIDATES:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        break

# Get connection details
PG_HOST = os.getenv('PG_HOST', 'db.bnfixjkjrbfalgcqhzof.supabase.co')
PG_DB = os.getenv('PG_DB', 'postgres')
PG_USER = os.getenv('PG_USER', 'postgres')
PG_PASSWORD = os.getenv('PG_PASSWORD')
PG_PORT = os.getenv('PG_PORT', '5432')

if not PG_PASSWORD:
    print("ERROR: PG_PASSWORD not found in environment variables")
    sys.exit(1)

try:
    import psycopg2
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
except ImportError:
    print("ERROR: psycopg2 not installed. Install with: pip install psycopg2-binary")
    sys.exit(1)

# Output file
output_file = BASE_DIR / "supabase" / "production_schema_complete.sql"

print(f"Exporting complete schema from {PG_HOST}...")
print(f"   Schemas: public, phc")
print(f"   Output: {output_file}")

try:
    conn = psycopg2.connect(
        host=PG_HOST,
        database=PG_DB,
        user=PG_USER,
        password=PG_PASSWORD,
        port=PG_PORT,
        sslmode='require'
    )
    
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        # Write header
        f.write(f"-- Complete Schema Export\n")
        f.write(f"-- Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"-- Source: {PG_HOST}/{PG_DB}\n")
        f.write(f"-- Schemas: public, phc\n\n")
        
        with conn.cursor() as cur:
            # Export extensions
            f.write("-- Extensions\n")
            cur.execute("""
                SELECT extname, extversion 
                FROM pg_extension 
                WHERE extname NOT IN ('plpgsql', 'pg_catalog', 'information_schema')
                ORDER BY extname;
            """)
            for ext_name, ext_version in cur.fetchall():
                f.write(f"CREATE EXTENSION IF NOT EXISTS {ext_name} WITH SCHEMA public VERSION '{ext_version}';\n")
            f.write("\n")
            
            # Export enums
            f.write("-- Enums\n")
            cur.execute("""
                SELECT t.typname, string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder)
                FROM pg_type t 
                JOIN pg_enum e ON t.oid = e.enumtypid  
                JOIN pg_namespace n ON n.oid = t.typnamespace
                WHERE n.nspname IN ('public', 'phc')
                GROUP BY t.typname, n.nspname
                ORDER BY t.typname;
            """)
            for enum_name, enum_labels in cur.fetchall():
                labels = "', '".join(enum_labels.split(','))
                f.write(f"CREATE TYPE {enum_name} AS ENUM ('{labels}');\n")
            f.write("\n")
            
            # Export tables with full structure
            f.write("-- Tables\n")
            cur.execute("""
                SELECT table_schema, table_name 
                FROM information_schema.tables 
                WHERE table_schema IN ('public', 'phc') 
                AND table_type = 'BASE TABLE'
                ORDER BY table_schema, table_name;
            """)
            tables = cur.fetchall()
            
            for schema, table_name in tables:
                f.write(f"\n-- Table: {schema}.{table_name}\n")
                
                # Get table definition
                cur.execute(f"""
                    SELECT column_name, data_type, character_maximum_length, 
                           is_nullable, column_default, udt_name
                    FROM information_schema.columns
                    WHERE table_schema = %s AND table_name = %s
                    ORDER BY ordinal_position;
                """, (schema, table_name))
                
                columns = []
                for col_name, data_type, max_len, is_nullable, default, udt_name in cur.fetchall():
                    col_def = f'"{col_name}"'
                    
                    if data_type == 'character varying':
                        col_def += f" VARCHAR({max_len})" if max_len else " VARCHAR"
                    elif data_type == 'character':
                        col_def += f" CHAR({max_len})" if max_len else " CHAR"
                    elif data_type == 'numeric':
                        cur.execute(f"""
                            SELECT numeric_precision, numeric_scale
                            FROM information_schema.columns
                            WHERE table_schema = %s AND table_name = %s AND column_name = %s;
                        """, (schema, table_name, col_name))
                        prec_result = cur.fetchone()
                        if prec_result and prec_result[0]:
                            prec, scale = prec_result[0], prec_result[1]
                            col_def += f" NUMERIC({prec},{scale})" if scale else f" NUMERIC({prec})"
                        else:
                            col_def += " NUMERIC"
                    elif data_type == 'USER-DEFINED':
                        col_def += f" {udt_name}"
                    else:
                        col_def += f" {data_type.upper()}"
                    
                    if is_nullable == 'NO':
                        col_def += " NOT NULL"
                    
                    if default:
                        col_def += f" DEFAULT {default}"
                    
                    columns.append(col_def)
                
                f.write(f"CREATE TABLE IF NOT EXISTS {schema}.{table_name} (\n")
                f.write(",\n".join(f"  {col}" for col in columns))
                f.write("\n);\n")
                
                # Get primary keys
                cur.execute(f"""
                    SELECT a.attname
                    FROM pg_index i
                    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                    WHERE i.indrelid = '{schema}.{table_name}'::regclass
                    AND i.indisprimary;
                """)
                pk_cols = [row[0] for row in cur.fetchall()]
                if pk_cols:
                    pk_cols_str = ', '.join(f'"{col}"' for col in pk_cols)
                    f.write(f"ALTER TABLE {schema}.{table_name} ADD PRIMARY KEY ({pk_cols_str});\n")
            
            # Export indexes
            f.write("\n-- Indexes\n")
            cur.execute("""
                SELECT schemaname, tablename, indexname, indexdef
                FROM pg_indexes
                WHERE schemaname IN ('public', 'phc')
                AND indexname NOT LIKE '%_pkey'
                ORDER BY schemaname, tablename, indexname;
            """)
            for schema, table, idx_name, idx_def in cur.fetchall():
                f.write(f"{idx_def};\n")
            
            # Export views
            f.write("\n-- Views\n")
            cur.execute("""
                SELECT table_schema, table_name, view_definition
                FROM information_schema.views
                WHERE table_schema IN ('public', 'phc')
                ORDER BY table_schema, table_name;
            """)
            for schema, view_name, view_def in cur.fetchall():
                f.write(f"\nCREATE OR REPLACE VIEW {schema}.{view_name} AS\n{view_def};\n")
            
            # Export functions
            f.write("\n-- Functions\n")
            cur.execute("""
                SELECT n.nspname, p.proname, pg_get_functiondef(p.oid) as func_def
                FROM pg_proc p
                JOIN pg_namespace n ON p.pronamespace = n.oid
                WHERE n.nspname IN ('public', 'phc')
                ORDER BY n.nspname, p.proname;
            """)
            for schema, func_name, func_def in cur.fetchall():
                f.write(f"\n{func_def}\n")
            
            # Export RLS policies
            f.write("\n-- Row Level Security Policies\n")
            cur.execute("""
                SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
                FROM pg_policies
                WHERE schemaname IN ('public', 'phc')
                ORDER BY schemaname, tablename, policyname;
            """)
            for schema, table, policy_name, permissive, roles, cmd, qual, with_check in cur.fetchall():
                roles_str = ', '.join(roles) if roles else 'public'
                f.write(f"\nCREATE POLICY {policy_name} ON {schema}.{table}\n")
                f.write(f"  AS {permissive}\n")
                f.write(f"  FOR {cmd}\n")
                f.write(f"  TO {roles_str}\n")
                if qual:
                    f.write(f"  USING ({qual})\n")
                if with_check:
                    f.write(f"  WITH CHECK ({with_check})\n")
                f.write(";\n")
            
            # Enable RLS on tables
            f.write("\n-- Enable RLS\n")
            cur.execute("""
                SELECT schemaname, tablename
                FROM pg_tables
                WHERE schemaname IN ('public', 'phc')
                AND rowsecurity = true
                ORDER BY schemaname, tablename;
            """)
            for schema, table in cur.fetchall():
                f.write(f"ALTER TABLE {schema}.{table} ENABLE ROW LEVEL SECURITY;\n")
    
    conn.close()
    file_size = output_file.stat().st_size / 1024
    print(f"SUCCESS: Complete schema exported: {file_size:.2f} KB")
    print(f"   File: {output_file}")
    
except Exception as e:
    print(f"ERROR: Failed to export schema: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

