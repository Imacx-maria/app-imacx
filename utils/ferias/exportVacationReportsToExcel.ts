import { saveAs } from "file-saver";
import { formatVacationBalance, getVacationStatus } from "./vacationHelpers";

type VacationReportRow = {
  employee_sigla: string;
  employee_name: string;
  departamento_nome?: string | null;
  previous_balance: number;
  current_total: number;
  current_used: number;
  remaining: number;
};

type ExportVacationReportsOptions = {
  rows: VacationReportRow[];
  fileName?: string;
};

export const exportVacationReportsToExcel = async ({
  rows,
  fileName,
}: ExportVacationReportsOptions): Promise<void> => {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Relatorio Ferias");

  const columns = [
    { header: "Sigla", key: "sigla", width: 12 },
    { header: "Nome", key: "nome", width: 32 },
    { header: "Dept", key: "departamento", width: 26 },
    { header: "Anterior", key: "anterior", width: 14 },
    { header: "Atual", key: "atual", width: 12 },
    { header: "Usado", key: "usado", width: 12 },
    { header: "Restante", key: "restante", width: 14 },
  ];

  worksheet.mergeCells(1, 1, 1, columns.length);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = "RELATORIO FERIAS - SALDOS";
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  worksheet.mergeCells(2, 1, 2, columns.length);
  const dateCell = worksheet.getCell(2, 1);
  dateCell.value = new Date().toLocaleDateString("pt-PT");
  dateCell.font = { size: 12 };
  dateCell.alignment = { horizontal: "center", vertical: "middle" };

  worksheet.mergeCells(3, 1, 3, columns.length);

  const headerRow = worksheet.addRow(columns.map((col) => col.header));
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F2937" },
    };
    cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  worksheet.columns = columns;

  rows.forEach((row) => {
    const excelRow = worksheet.addRow([
      row.employee_sigla,
      row.employee_name,
      row.departamento_nome || "",
      formatVacationBalance(row.previous_balance),
      formatVacationBalance(row.current_total),
      formatVacationBalance(row.current_used),
      formatVacationBalance(row.remaining),
    ]);

    excelRow.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };

      if (colNumber === 1) {
        cell.alignment = { horizontal: "center" };
      } else if (colNumber >= 4) {
        cell.alignment = { horizontal: "right" };
      } else {
        cell.alignment = { horizontal: "left" };
      }
      cell.alignment = { ...cell.alignment, vertical: "middle" };
    });

    const status = getVacationStatus(
      row.remaining,
      row.previous_balance + row.current_total,
    );
    const restanteCell = excelRow.getCell(7);

    if (status === "critical") {
      restanteCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFEE2E2" },
      };
    } else if (status === "warning") {
      restanteCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFDF6B2" },
      };
    }
  });

  worksheet.views = [{ state: "frozen", ySplit: 4 }];
  worksheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: columns.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const name =
    fileName ||
    `ferias_relatorio_saldos_${new Date().toISOString().slice(0, 10)}.xlsx`;
  saveAs(new Blob([buffer]), name);
};
