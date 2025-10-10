import { useState, useCallback } from 'react';

const MAX_FILES = 10;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/tiff',
  // Documents
  'application/pdf',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'text/csv',
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
];

export interface QueuedFile {
  file: File;
  id: string;
  preview?: string; // For image thumbnails
  error?: string;
}

export interface ValidationError {
  type: 'size' | 'type' | 'limit';
  message: string;
  fileName: string;
}

export function useAttachmentQueue() {
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  const validateFile = useCallback((file: File): string | null => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds 20MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB)`;
    }

    // Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return `File type not allowed: ${file.type || 'unknown'}`;
    }

    return null;
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const errors: ValidationError[] = [];
    const newFiles: QueuedFile[] = [];

    // Check total file count limit
    if (queuedFiles.length + fileArray.length > MAX_FILES) {
      errors.push({
        type: 'limit',
        message: `Cannot add ${fileArray.length} files. Maximum ${MAX_FILES} files allowed (${queuedFiles.length} already queued)`,
        fileName: 'multiple files',
      });
      setValidationErrors(errors);
      return;
    }

    fileArray.forEach(file => {
      const validationError = validateFile(file);
      
      if (validationError) {
        errors.push({
          type: validationError.includes('size') ? 'size' : 'type',
          message: validationError,
          fileName: file.name,
        });
      } else {
        const queuedFile: QueuedFile = {
          file,
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };

        // Generate preview for images
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setQueuedFiles(prev => 
              prev.map(f => 
                f.id === queuedFile.id 
                  ? { ...f, preview: reader.result as string }
                  : f
              )
            );
          };
          reader.readAsDataURL(file);
        }

        newFiles.push(queuedFile);
      }
    });

    if (newFiles.length > 0) {
      setQueuedFiles(prev => [...prev, ...newFiles]);
    }

    setValidationErrors(errors);
  }, [queuedFiles.length, validateFile]);

  const removeFile = useCallback((id: string) => {
    setQueuedFiles(prev => prev.filter(f => f.id !== id));
    // Clear errors when a file is removed
    setValidationErrors([]);
  }, []);

  const clearQueue = useCallback(() => {
    setQueuedFiles([]);
    setValidationErrors([]);
  }, []);

  const clearErrors = useCallback(() => {
    setValidationErrors([]);
  }, []);

  return {
    queuedFiles,
    validationErrors,
    addFiles,
    removeFile,
    clearQueue,
    clearErrors,
    hasFiles: queuedFiles.length > 0,
    fileCount: queuedFiles.length,
    canAddMore: queuedFiles.length < MAX_FILES,
  };
}
