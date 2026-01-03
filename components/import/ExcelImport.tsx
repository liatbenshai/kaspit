'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { Select } from '@/components/ui/Select'
import { Upload, FileSpreadsheet, X, Check } from 'lucide-react'
import * as XLSX from 'xlsx'

interface ExcelImportProps {
  type: 'income' | 'expense' | 'bank'
  requiredFields: { key: string; label: string; required: boolean }[]
  onImport: (data: Record<string, any>[]) => Promise<void>
  onClose: () => void
}

export function ExcelImport({ type, requiredFields, onImport, onClose }: ExcelImportProps) {
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [previewData, setPreviewData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.match(/\.(xlsx|xls|csv)$/i)) {
      setError('נא להעלות קובץ Excel או CSV')
      return
    }

    setFile(selectedFile)
    setError(null)

    try {
      const data = await readExcelFile(selectedFile)
      if (data.length === 0) {
        setError('הקובץ ריק')
        return
      }

      const fileHeaders = Object.keys(data[0])
      setHeaders(fileHeaders)
      setPreviewData(data)

      // Auto-map matching headers
      const autoMapping: Record<string, string> = {}
      requiredFields.forEach((field) => {
        const match = fileHeaders.find(
          (h) => h.toLowerCase() === field.label.toLowerCase() ||
                 h.toLowerCase() === field.key.toLowerCase()
        )
        if (match) {
          autoMapping[field.key] = match
        }
      })
      setMapping(autoMapping)
      setStep('mapping')
    } catch (err) {
      setError('שגיאה בקריאת הקובץ')
    }
  }

  const readExcelFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = e.target?.result
          const workbook = XLSX.read(data, { type: 'binary', cellDates: true })
          const sheetName = workbook.SheetNames[0]
          const sheet = workbook.Sheets[sheetName]
          const json = XLSX.utils.sheet_to_json(sheet)
          resolve(json)
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = reject
      reader.readAsBinaryString(file)
    })
  }

  const handleMappingChange = (fieldKey: string, excelHeader: string) => {
    setMapping((prev) => ({ ...prev, [fieldKey]: excelHeader }))
  }

  const validateMapping = (): boolean => {
    const missingRequired = requiredFields
      .filter((f) => f.required && !mapping[f.key])
      .map((f) => f.label)

    if (missingRequired.length > 0) {
      setError(`שדות חובה חסרים: ${missingRequired.join(', ')}`)
      return false
    }
    return true
  }

  const handlePreview = () => {
    if (!validateMapping()) return
    setError(null)
    setStep('preview')
  }

  const getMappedData = (): Record<string, any>[] => {
    return previewData.map((row) => {
      const mappedRow: Record<string, any> = {}
      Object.entries(mapping).forEach(([fieldKey, excelHeader]) => {
        if (excelHeader && row[excelHeader] !== undefined) {
          mappedRow[fieldKey] = row[excelHeader]
        }
      })
      return mappedRow
    })
  }

  const handleImport = async () => {
    setLoading(true)
    setError(null)

    try {
      const mappedData = getMappedData()
      await onImport(mappedData)
      onClose()
    } catch (err: any) {
      setError(err.message || 'שגיאה בייבוא הנתונים')
    } finally {
      setLoading(false)
    }
  }

  const typeLabels = {
    income: 'הכנסות',
    expense: 'הוצאות',
    bank: 'תנועות בנק',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">ייבוא {typeLabels[type]} מאקסל</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <Alert variant="danger" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary-500 transition-colors"
        >
          <FileSpreadsheet className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 mb-2">גרור קובץ לכאן או לחץ לבחירה</p>
          <p className="text-sm text-gray-400">Excel (.xlsx, .xls) או CSV</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Step 2: Mapping */}
      {step === 'mapping' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
            <FileSpreadsheet className="w-4 h-4" />
            <span>{file?.name}</span>
            <span className="text-gray-400">({previewData.length} שורות)</span>
          </div>

          <div className="space-y-3">
            <h3 className="font-medium text-gray-900">התאמת עמודות</h3>
            <p className="text-sm text-gray-500">התאם כל שדה לעמודה המתאימה בקובץ</p>

            {requiredFields.map((field) => (
              <div key={field.key} className="flex items-center gap-4">
                <div className="w-1/3">
                  <span className="text-sm font-medium text-gray-700">
                    {field.label}
                    {field.required && <span className="text-danger-500 mr-1">*</span>}
                  </span>
                </div>
                <div className="w-2/3">
                  <Select
                    options={[
                      { value: '', label: 'בחר עמודה...' },
                      ...headers.map((h) => ({ value: h, label: h })),
                    ]}
                    value={mapping[field.key] || ''}
                    onChange={(e) => handleMappingChange(field.key, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => setStep('upload')}>
              חזרה
            </Button>
            <Button onClick={handlePreview}>המשך לתצוגה מקדימה</Button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && (
        <div className="space-y-4">
          <div className="bg-success-50 border border-success-200 rounded-lg p-3 flex items-center gap-2">
            <Check className="w-5 h-5 text-success-600" />
            <span className="text-success-800">
              מוכן לייבוא {previewData.length} רשומות
            </span>
          </div>

          <div className="max-h-64 overflow-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {requiredFields
                    .filter((f) => mapping[f.key])
                    .map((f) => (
                      <th key={f.key} className="px-3 py-2 text-right font-medium">
                        {f.label}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {getMappedData()
                  .slice(0, 5)
                  .map((row, i) => (
                    <tr key={i}>
                      {requiredFields
                        .filter((f) => mapping[f.key])
                        .map((f) => (
                          <td key={f.key} className="px-3 py-2">
                            {String(row[f.key] ?? '')}
                          </td>
                        ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {previewData.length > 5 && (
            <p className="text-sm text-gray-500 text-center">
              ו-{previewData.length - 5} שורות נוספות...
            </p>
          )}

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => setStep('mapping')}>
              חזרה
            </Button>
            <Button onClick={handleImport} loading={loading}>
              <Upload className="w-4 h-4" />
              ייבא {previewData.length} רשומות
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
