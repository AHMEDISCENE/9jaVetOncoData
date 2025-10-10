import { useState, useCallback } from 'react';

const MAX_FILES = 10;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const ALLOWED_DOC_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
]);

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

    // Check MIME type (allow any image/* plus permitted document types)
    if (!(file.type?.startsWith('image/') || ALLOWED_DOC_MIME_TYPES.has(file.type))) {
      return `File type not allowed: ${file.type || 'unknown'}`;
    }

    return null;
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const errors: ValidationError[] = [];
    const newFiles: QueuedFile[] = [];

    const availableSlots = MAX_FILES - queuedFiles.length;

    if (availableSlots <= 0) {
      errors.push({
        type: 'limit',
        message: `Maximum ${MAX_FILES} files allowed. Remove a file before adding another.`,
        fileName: 'multiple files',
      });
      setValidationErrors(errors);
      return;
    }

    const filesToProcess = fileArray.slice(0, availableSlots);

    if (fileArray.length > availableSlots) {
      errors.push({
        type: 'limit',
        message: `Only ${availableSlots} more file(s) can be added (maximum ${MAX_FILES}).`,
        fileName: 'multiple files',
      });
    }

    filesToProcess.forEach(file => {
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
    maxFiles: MAX_FILES,
    maxFileSize: MAX_FILE_SIZE,
  };
}
