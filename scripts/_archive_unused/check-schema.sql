-- Check if new columns exist in producao_operacoes table
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM
    information_schema.columns
WHERE
    table_schema = 'public'
    AND table_name = 'producao_operacoes'
    AND column_name IN (
        'QT_print_planned',
        'QT_corte_planned',
        'print_job_id',
        'cut_job_id',
        'is_source_record',
        'parent_operation_id'
    )
ORDER BY
    ordinal_position;
