import * as XLSX from 'xlsx'

export interface ParsedFile {
  filename: string
  fileType: 'csv' | 'xlsx'
  headers: string[]
  rows: Record<string, string>[]
  rowCount: number
}

/**
 * Parse CSV or Excel file and extract headers and rows
 */
export async function parseFile(file: File): Promise<ParsedFile> {
  const filename = file.name
  const extension = filename.split('.').pop()?.toLowerCase()
  
  if (extension === 'csv') {
    return parseCSV(file)
  } else if (extension === 'xlsx' || extension === 'xls') {
    return parseExcel(file)
  } else {
    throw new Error(`Unsupported file type: ${extension}`)
  }
}

async function parseCSV(file: File): Promise<ParsedFile> {
  const text = await file.text()
  const lines = text.split(/\r?\n/).filter(line => line.trim())
  
  if (lines.length === 0) {
    throw new Error('CSV file is empty')
  }
  
  // Parse headers (first line)
  const headers = parseCSVLine(lines[0])
  
  // Parse data rows
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })
    rows.push(row)
  }
  
  return {
    filename: file.name,
    fileType: 'csv',
    headers,
    rows,
    rowCount: rows.length
  }
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if ((char === ',' || char === ';') && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  values.push(current.trim())
  return values
}

async function parseExcel(file: File): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  
  // Use first sheet
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  
  // Convert to JSON with header row
  const jsonData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { 
    header: 1,
    defval: ''
  }) as unknown[][]
  
  if (jsonData.length === 0) {
    throw new Error('Excel file is empty')
  }
  
  const headers = jsonData[0].map(h => String(h || '').trim())
  const rows: Record<string, string>[] = []
  
  for (let i = 1; i < jsonData.length; i++) {
    const rowData = jsonData[i]
    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      row[header] = String(rowData[index] || '').trim()
    })
    rows.push(row)
  }
  
  return {
    filename: file.name,
    fileType: file.name.endsWith('.xlsx') ? 'xlsx' : 'xlsx',
    headers,
    rows,
    rowCount: rows.length
  }
}
