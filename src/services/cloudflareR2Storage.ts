import { supabase } from '@/integrations/supabase/client';

interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
  fileId?: string;
}

interface FileMetadata {
  url: string;
  type: string;
  size: number;
  userId: string;
  fileName: string;
}

export class CloudflareR2Storage {
  private baseUrl: string;
  private accountId: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private bucketName: string;

  constructor() {
    // These should be set via environment variables
    this.baseUrl = import.meta.env.VITE_CLOUDFLARE_R2_URL || '';
    this.accountId = import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID || '';
    this.accessKeyId = import.meta.env.VITE_CLOUDFLARE_ACCESS_KEY_ID || '';
    this.secretAccessKey = import.meta.env.VITE_CLOUDFLARE_SECRET_ACCESS_KEY || '';
    this.bucketName = import.meta.env.VITE_CLOUDFLARE_BUCKET_NAME || '';
  }

  /**
   * Generate a signed upload URL for direct file upload to R2
   */
  async generateSignedUploadUrl(
    fileName: string,
    fileType: string,
    fileSize: number,
    userId: string
  ): Promise<UploadResult> {
    try {
      // Call our Edge Function to generate signed URL
      const { data, error } = await supabase.functions.invoke('generate-r2-upload-url', {
        body: {
          fileName,
          fileType,
          fileSize,
          userId,
          bucketName: this.bucketName
        }
      });

      if (error) {
        throw new Error(`Failed to generate upload URL: ${error.message}`);
      }

      if (!data?.uploadUrl) {
        throw new Error('No upload URL received from server');
      }

      return {
        success: true,
        url: data.uploadUrl,
        fileId: data.fileId
      };
    } catch (error) {
      console.error('Error generating signed upload URL:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Upload file through Edge Function proxy (avoids CORS issues)
   */
  async uploadFile(
    file: File,
    signedUrl: string,
    onProgress?: (progress: number) => void
  ): Promise<UploadResult> {
    try {
      // Instead of direct upload to R2, upload through our Edge Function
      const formData = new FormData();
      formData.append('file', file);
      formData.append('signedUrl', signedUrl);

      // Get auth token first
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable && onProgress) {
            const progress = (event.loaded / event.total) * 100;
            onProgress(progress);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            if (response.success) {
              resolve({
                success: true,
                url: response.url,
                fileId: response.fileId
              });
            } else {
              reject(new Error(response.error || 'Upload failed'));
            }
          } else {
            reject(new Error(`Upload failed with status: ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed due to network error'));
        });

        xhr.open('POST', `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-to-r2`);
        
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        
        xhr.send(formData);
      });
    } catch (error) {
      console.error('Error uploading file to R2:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  /**
   * Store file metadata in Supabase database
   */
  async storeFileMetadata(metadata: FileMetadata): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('file_metadata')
        .insert({
          url: metadata.url,
          type: metadata.type,
          size: metadata.size,
          user_id: metadata.userId,
          file_name: metadata.fileName,
          created_at: new Date().toISOString()
        });

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error storing file metadata:', error);
      return false;
    }
  }

  /**
   * Complete file upload process
   */
  async completeFileUpload(
    file: File,
    userId: string,
    onProgress?: (progress: number) => void
  ): Promise<UploadResult> {
    try {
      // Step 1: Generate signed upload URL
      const urlResult = await this.generateSignedUploadUrl(
        file.name,
        file.type,
        file.size,
        userId
      );

      if (!urlResult.success || !urlResult.url) {
        throw new Error(urlResult.error || 'Failed to generate upload URL');
      }

      // Step 2: Upload file to R2
      const uploadResult = await this.uploadFile(file, urlResult.url, onProgress);

      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(uploadResult.error || 'File upload failed');
      }

      // Step 3: Store metadata in database
      const metadataStored = await this.storeFileMetadata({
        url: uploadResult.url,
        type: file.type,
        size: file.size,
        userId,
        fileName: file.name
      });

      if (!metadataStored) {
        console.warn('File uploaded but metadata storage failed');
      }

      return {
        success: true,
        url: uploadResult.url,
        fileId: uploadResult.fileId
      };
    } catch (error) {
      console.error('Error completing file upload:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload process failed'
      };
    }
  }

  /**
   * Generate a signed download URL for file access
   */
  async generateSignedDownloadUrl(fileUrl: string, expiresIn: number = 3600): Promise<string | null> {
    try {
      const { data, error } = await supabase.functions.invoke('generate-r2-download-url', {
        body: {
          fileUrl,
          expiresIn,
          bucketName: this.bucketName
        }
      });

      if (error || !data?.downloadUrl) {
        throw new Error('Failed to generate download URL');
      }

      return data.downloadUrl;
    } catch (error) {
      console.error('Error generating download URL:', error);
      return null;
    }
  }

  /**
   * Delete file from R2
   */
  async deleteFile(fileUrl: string): Promise<boolean> {
    try {
      const { error } = await supabase.functions.invoke('delete-r2-file', {
        body: {
          fileUrl,
          bucketName: this.bucketName
        }
      });

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error deleting file from R2:', error);
      return false;
    }
  }

  /**
   * Extract file ID from signed URL
   */
  private extractFileIdFromUrl(url: string): string {
    const urlParts = url.split('/');
    return urlParts[urlParts.length - 1].split('?')[0];
  }

  /**
   * Check if R2 storage is properly configured
   */
  isConfigured(): boolean {
    return !!(this.baseUrl && this.accountId && this.accessKeyId && this.secretAccessKey && this.bucketName);
  }

  /**
   * Get storage usage statistics
   */
  async getStorageUsage(userId: string): Promise<{ used: number; limit: number } | null> {
    try {
      const { data, error } = await supabase
        .from('file_metadata')
        .select('size')
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      const used = data?.reduce((total, file) => total + (file.size || 0), 0) || 0;
      const limit = 10 * 1024 * 1024 * 1024; // 10 GB in bytes

      return { used, limit };
    } catch (error) {
      console.error('Error getting storage usage:', error);
      return null;
    }
  }
}

// Export singleton instance
export const cloudflareR2Storage = new CloudflareR2Storage();
