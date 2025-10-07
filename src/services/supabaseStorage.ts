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

export class SupabaseStorage {
  private bucketName: string;

  constructor() {
    this.bucketName = 'user-uploads'; // Match the bucket name from migration
  }

  /**
   * Upload file directly to Supabase Storage
   */
  async uploadFile(
    file: File,
    userId: string,
    onProgress?: (progress: number) => void
  ): Promise<UploadResult> {
    try {
      // Ensure bucket exists before uploading
      await this.ensureBucketExists();

      // Generate unique file path (matching migration structure)
      const fileId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const filePath = `course-uploads/${userId}/${fileId}_${file.name}`;

      console.log('Uploading file to Supabase Storage:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        filePath,
        bucketName: this.bucketName
      });

      // Upload file to Supabase Storage
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Supabase Storage upload error:', error);
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(this.bucketName)
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL for uploaded file');
      }

      console.log('File uploaded successfully:', {
        path: data.path,
        publicUrl: urlData.publicUrl
      });

      return {
        success: true,
        url: urlData.publicUrl,
        fileId: fileId
      };
    } catch (error) {
      console.error('Error uploading file to Supabase Storage:', error);
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
        console.error('Error storing file metadata:', error);
        return false;
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
      // Step 1: Upload file to Supabase Storage
      const uploadResult = await this.uploadFile(file, userId, onProgress);

      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(uploadResult.error || 'File upload failed');
      }

      // Step 2: Store metadata in database
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
   * Delete file from Supabase Storage
   */
  async deleteFile(fileUrl: string): Promise<boolean> {
    try {
      // Extract file path from URL
      const url = new URL(fileUrl);
      const pathParts = url.pathname.split('/');
      const bucketIndex = pathParts.findIndex(part => part === this.bucketName);
      
      if (bucketIndex === -1 || bucketIndex === pathParts.length - 1) {
        console.error('Could not extract file path from URL:', fileUrl);
        return false;
      }

      const filePath = pathParts.slice(bucketIndex + 1).join('/');
      
      console.log('Deleting file from Supabase Storage:', {
        fileUrl,
        filePath,
        bucketName: this.bucketName
      });

      const { error } = await supabase.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        console.error('Error deleting file from Supabase Storage:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error deleting file from Supabase Storage:', error);
      return false;
    }
  }

  /**
   * Check if Supabase Storage is properly configured
   */
  isConfigured(): boolean {
    // Supabase Storage is always available if Supabase is configured
    return !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
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

  /**
   * Create storage bucket if it doesn't exist
   */
  async ensureBucketExists(): Promise<boolean> {
    try {
      // Check if bucket exists by trying to list files
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .list('', { limit: 1 });

      if (error && error.message.toLowerCase().includes('not found')) {
        console.log(`Bucket '${this.bucketName}' does not exist. Attempting to create it...`);
        
        // Try to create the bucket using Edge Function
        try {
          const { data: createResult, error: createError } = await supabase.functions.invoke('ensure-storage-bucket');
          
          if (createError) {
            console.error('Error calling ensure-storage-bucket function:', createError);
            throw new Error(`Failed to create storage bucket: ${createError.message}`);
          }
          
          if (createResult?.success) {
            console.log('Storage bucket created successfully:', createResult.message);
            return true;
          } else {
            throw new Error(createResult?.error || 'Unknown error creating bucket');
          }
        } catch (createError) {
          console.error('Failed to create storage bucket:', createError);
          throw new Error(`Storage bucket '${this.bucketName}' does not exist and could not be created. Please create it manually in Supabase Dashboard.`);
        }
      } else if (error) {
        console.error('Error checking bucket existence:', error);
        throw new Error(`Failed to check bucket existence: ${error.message}`);
      }

      return true;
    } catch (error) {
      console.error('Error ensuring bucket exists:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const supabaseStorage = new SupabaseStorage();
