export type CsvHeader = {
  key: string;
  label: string;
};

export type CsvRow = Record<string, unknown>;

const formatDateForLagos = () => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date());
};

const escapeCsvValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);
  const shouldQuote = /[",\n\r]/.test(stringValue);
  const shouldQuote = /[",\n]/.test(stringValue);
  const escapedValue = stringValue.replace(/"/g, '""');

  return shouldQuote ? `"${escapedValue}"` : escapedValue;
};

export interface ExportToCsvOptions {
  rows: CsvRow[];
  headers: CsvHeader[];
  filename: string;
}

export const exportToCsv = ({ rows, headers, filename }: ExportToCsvOptions) => {
  if (!headers.length) {
    throw new Error("CSV export requires at least one header");
  }

  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("CSV export is only available in the browser");
  }

  const headerLine = headers.map((header) => escapeCsvValue(header.label)).join(",");
  const dataLines = rows.map((row) =>
    headers.map((header) => escapeCsvValue(row[header.key])).join(",")
  );

  const newline = "\r\n";
  const csvContent = [headerLine, ...dataLines].join(newline);
  const blobContent = `\ufeff${csvContent}`;
  const blob = new Blob([blobContent], { type: "text/csv;charset=utf-8;" });
  const dateSuffix = formatDateForLagos();
  const filenameWithDate = `${filename}_${dateSuffix}.csv`;
  const link = document.createElement("a");
  link.setAttribute("download", filenameWithDate);

  const navigatorWithSave = window.navigator as Navigator & {
    msSaveOrOpenBlob?: (blob: Blob, defaultName?: string) => boolean;
  };

  if (typeof navigatorWithSave.msSaveOrOpenBlob === "function") {
    navigatorWithSave.msSaveOrOpenBlob(blob, filenameWithDate);
    return;
  }

  const url = URL.createObjectURL(blob);
  link.href = url;
  try {
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(url);
  }
  const csvContent = [headerLine, ...dataLines].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const dateSuffix = formatDateForLagos();
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${filename}_${dateSuffix}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};
