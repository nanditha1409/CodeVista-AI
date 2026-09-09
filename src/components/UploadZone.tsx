import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileArchive, AlertCircle } from 'lucide-react'
import { useFileStore } from '../stores/fileStore'
import { useAnalysisStore } from '../stores/analysisStore'

export function UploadZone() {
  const { uploadZip, loading } = useFileStore()
  const clearAnalysis = useAnalysisStore((s) => s.clearAnalysis)

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles[0]) {
        clearAnalysis()
        uploadZip(acceptedFiles[0])
      }
    },
    [clearAnalysis, uploadZip]
  )

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: { 'application/zip': ['.zip'], 'application/x-zip-compressed': ['.zip'] },
    maxSize: 50 * 1024 * 1024,
    multiple: false,
    disabled: loading,
  })

  const hasRejections = fileRejections.length > 0

  return (
    <section className="border-b border-white/10 bg-[#0D0D1F] px-4 py-5">
      <div className="flex items-center gap-2 mb-4">
        <Upload size={16} className="text-emerald-400" />
        <span className="text-sm font-semibold text-white/90">Local ZIP Upload</span>
      </div>

      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all
          ${isDragActive
            ? 'border-emerald-500 bg-emerald-500/10 scale-[1.02]'
            : hasRejections
            ? 'border-red-500/50 bg-red-500/5'
            : 'border-white/15 hover:border-emerald-500/50 hover:bg-white/5'
          }
          ${loading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <FileArchive
          size={28}
          className={`mx-auto mb-2 ${isDragActive ? 'text-emerald-400' : 'text-white/30'}`}
        />
        <p className="text-xs text-white/60">
          {isDragActive ? (
            <span className="text-emerald-400 font-medium">Drop it here!</span>
          ) : (
            <>
              <span className="text-white/80">Drag & drop</span> a ZIP file
              <br />
              <span className="text-white/30">or click to browse · max 50MB</span>
            </>
          )}
        </p>
      </div>

      {hasRejections && (
        <div className="mt-2 flex items-center gap-2 text-red-400">
          <AlertCircle size={12} />
          <p className="text-xs">
            {fileRejections[0]?.errors[0]?.message ?? 'Invalid file. Only .zip files accepted.'}
          </p>
        </div>
      )}
    </section>
  )
}
