import { appSettings } from '../ui/components/welcome-screen';

// Interface for GitHub API responses
interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: string;
  content?: string;
  encoding?: string;
  url: string;
  download_url?: string;
}

/**
 * GitHub service for saving and loading projects from GitHub
 */
export class GitHubService {
  private apiBase = 'https://api.github.com';
  private token: string;
  private repo: string;
  private username: string;
  
  constructor() {
    // Initialize with values from app settings
    this.token = appSettings.githubToken || '';
    this.repo = appSettings.githubRepo?.split('/')[1] || '';
    this.username = appSettings.githubRepo?.split('/')[0] || '';
  }
  
  /**
   * Set or update the auth token
   */
  setAuthToken(token: string): void {
    this.token = token;
  }
  
  /**
   * Set or update the repository path
   */
  setRepository(owner: string, repo: string): void {
    this.username = owner;
    this.repo = repo;
  }
  
  /**
   * List all project files in the repository
   */
  async listProjects(): Promise<{ name: string, path: string }[]> {
    try {
      // Always refresh settings from appSettings to get the latest values
      this.token = appSettings.githubToken || '';
      this.repo = appSettings.githubRepo?.split('/')[1] || '';
      this.username = appSettings.githubRepo?.split('/')[0] || '';
      
      if (!this.username || !this.repo) {
        throw new Error('GitHub repository information is required');
      }
      
      console.log(`Listing projects from GitHub: ${this.username}/${this.repo}`);
      
      // Authorization is required for private repos
      const headers: HeadersInit = {
        'Accept': 'application/vnd.github.v3+json',
      };
      
      if (this.token) {
        headers['Authorization'] = `token ${this.token}`;
      }
      
      // Get contents of the repo
      const response = await fetch(
        `${this.apiBase}/repos/${this.username}/${this.repo}/contents`,
        { headers }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json() as GitHubFile[];
      
      // Filter for .dawn.zip files
      const projects = data
        .filter(file => file.type === 'file' && file.name.endsWith('.dawn.zip'))
        .map(file => ({
          name: file.name,
          path: file.path
        }));
      
      console.log(`Found ${projects.length} DAWN projects in repository`);
      return projects;
    } catch (error) {
      console.error('Error listing GitHub projects:', error);
      throw new Error('Failed to list projects from GitHub: ' + (error as Error).message);
    }
  }
  
  /**
   * Get a project file from GitHub
   */
  async getProject(path: string): Promise<Blob> {
    try {
      // Always refresh settings from appSettings to get the latest values
      this.token = appSettings.githubToken || '';
      this.repo = appSettings.githubRepo?.split('/')[1] || '';
      this.username = appSettings.githubRepo?.split('/')[0] || '';
      
      if (!this.username || !this.repo) {
        throw new Error('GitHub repository information is required');
      }
      
      console.log(`Getting project from GitHub: ${this.username}/${this.repo}/${path}`);
      
      // Authorization is required for private repos
      const headers: HeadersInit = {
        'Accept': 'application/vnd.github.v3.raw',
      };
      
      if (this.token) {
        headers['Authorization'] = `token ${this.token}`;
      }
      
      // First get the file metadata to get the download URL
      const metaResponse = await fetch(
        `${this.apiBase}/repos/${this.username}/${this.repo}/contents/${path}`,
        { headers: { ...headers, 'Accept': 'application/vnd.github.v3+json' } }
      );
      
      if (!metaResponse.ok) {
        const errorText = await metaResponse.text();
        throw new Error(`GitHub API error: ${metaResponse.status} ${metaResponse.statusText} - ${errorText}`);
      }
      
      const fileData = await metaResponse.json() as GitHubFile;
      
      if (!fileData.download_url) {
        throw new Error('No download URL available for file');
      }
      
      console.log(`Found file, download URL: ${fileData.download_url}`);
      
      // Download the actual file content
      const contentResponse = await fetch(fileData.download_url);
      
      if (!contentResponse.ok) {
        throw new Error(`Failed to download file: ${contentResponse.status} ${contentResponse.statusText}`);
      }
      
      const blob = await contentResponse.blob();
      console.log(`Downloaded file from GitHub: ${path}, size: ${blob.size} bytes`);
      
      return blob;
    } catch (error) {
      console.error('Error getting project from GitHub:', error);
      throw new Error('Failed to get project from GitHub: ' + (error as Error).message);
    }
  }
  
  /**
   * Save a project to GitHub
   */
  async saveProject(name: string, content: Blob): Promise<void> {
    try {
      // Always refresh settings from appSettings to get the latest values
      this.token = appSettings.githubToken || '';
      this.repo = appSettings.githubRepo?.split('/')[1] || '';
      this.username = appSettings.githubRepo?.split('/')[0] || '';
      
      if (!this.token) {
        throw new Error('GitHub token is required to save projects');
      }
      
      if (!this.username || !this.repo) {
        throw new Error('GitHub repository information is required');
      }
      
      console.log(`Preparing to save to GitHub: ${this.username}/${this.repo}/${name}`);
      
      // Convert blob to base64
      const base64Content = await this.blobToBase64(content);
      
      // Authorization header
      const headers: HeadersInit = {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${this.token}`,
        'Content-Type': 'application/json',
      };
      
      // Check if file already exists to get the SHA
      let sha: string | undefined;
      
      try {
        const checkResponse = await fetch(
          `${this.apiBase}/repos/${this.username}/${this.repo}/contents/${name}`,
          { headers }
        );
        
        if (checkResponse.ok) {
          const existingFile = await checkResponse.json() as GitHubFile;
          sha = existingFile.sha;
          console.log(`File exists, will update using SHA: ${sha}`);
        }
      } catch (error) {
        // File doesn't exist, which is fine
        console.log('File does not exist yet, creating new file');
      }
      
      // Prepare the request body
      const body: Record<string, string> = {
        message: `Update ${name} via DAWN DAW`,
        content: base64Content,
      };
      
      // If we have a SHA, include it to update the existing file
      if (sha) {
        body.sha = sha;
      }
      
      console.log(`Sending GitHub API request to save ${name}`);
      
      // Save the file
      const response = await fetch(
        `${this.apiBase}/repos/${this.username}/${this.repo}/contents/${name}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify(body),
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      console.log(`Project saved to GitHub: ${name}`);
    } catch (error) {
      console.error('Error saving project to GitHub:', error);
      throw new Error('Failed to save project to GitHub: ' + (error as Error).message);
    }
  }
  
  /**
   * Helper to convert a Blob to a base64 string
   */
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          // Remove the data URL prefix (data:application/octet-stream;base64,)
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  
  /**
   * Validate GitHub credentials
   */
  async validateCredentials(): Promise<boolean> {
    try {
      // Always refresh settings from appSettings first
      this.token = appSettings.githubToken || '';
      this.repo = appSettings.githubRepo?.split('/')[1] || '';
      this.username = appSettings.githubRepo?.split('/')[0] || '';
      
      console.log(`Validating GitHub credentials for: ${this.username}/${this.repo}`);
      
      // Validate required fields
      if (!this.token) {
        console.error('GitHub token is missing');
        throw new Error('GitHub token is required');
      }
      
      if (!this.username || !this.repo) {
        console.error('GitHub repository information is incomplete');
        throw new Error('GitHub repository must be in the format "username/repo"');
      }
      
      const headers: HeadersInit = {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${this.token}`,
      };
      
      // Try to access the repository
      console.log(`Sending request to GitHub API to validate access to ${this.username}/${this.repo}`);
      const response = await fetch(
        `${this.apiBase}/repos/${this.username}/${this.repo}`,
        { headers }
      );
      
      if (response.ok) {
        console.log('GitHub credentials validation successful');
        
        // Try to list the contents to verify we have proper access
        const contentsResponse = await fetch(
          `${this.apiBase}/repos/${this.username}/${this.repo}/contents`,
          { headers }
        );
        
        if (contentsResponse.ok) {
          console.log('Repository contents access verified');
          return true;
        } else {
          console.error(`Failed to access repository contents: ${contentsResponse.status} ${contentsResponse.statusText}`);
          // If we get a 404, the repo might exist but be empty
          return contentsResponse.status === 404;
        }
      } else {
        const errorText = await response.text();
        console.error(`GitHub validation failed: ${response.status} ${response.statusText}`);
        console.error('Error details:', errorText);
        
        if (response.status === 401) {
          throw new Error('GitHub authentication failed. Please check your token.');
        } else if (response.status === 404) {
          throw new Error(`Repository ${this.username}/${this.repo} not found. Please check the repository name.`);
        } else {
          throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }
      }
    } catch (error) {
      console.error('Error validating GitHub credentials:', error);
      throw error;
    }
  }
}