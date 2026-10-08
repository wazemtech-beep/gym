/**
 * Generate native Excel Workbook XML (SpreadsheetML) compatible with Microsoft Excel,
 * Google Sheets, Apple Numbers, and LibreOffice.
 */
export function generateExcelWorkbookXml(sheetName: string, headers: string[], rows: (string | number)[][]): string {
  const sanitize = (val: string | number) => {
    if (typeof val === "number") return `<Cell><Data ss:Type="Number">${val}</Data></Cell>`;
    const str = String(val ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<Cell><Data ss:Type="String">${str}</Data></Cell>`;
  };

  const headerCells = headers
    .map(
      (h) =>
        `<Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${h.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</Data></Cell>`
    )
    .join("");

  const dataRows = (rows as any[])
    .map((row) => `<Row>${row.map(sanitize).join("")}</Row>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1E293B"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="HeaderStyle">
   <Alignment ss:Vertical="Center" ss:Horizontal="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${sheetName.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 31)}">
  <Table>
   <Row>${headerCells}</Row>
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`;
}
