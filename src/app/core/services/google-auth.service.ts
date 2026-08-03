import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { Capacitor } from '@capacitor/core';
import { lastValueFrom } from 'rxjs';

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  givenName?: string;
  familyName?: string;
  imageUrl?: string;
  accessToken?: string;
}

export interface GoogleConfig {
  clientId: string;
  apiKey?: string;
}

const GOOGLE_AUTH_STORAGE_KEY = 'horahome_google_user';
const DEFAULT_CLIENT_ID = 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';

@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  readonly currentUser = signal<GoogleUser | null>(null);
  private isInitialized = false;
  private clientId = DEFAULT_CLIENT_ID;
  private apiKey = '';

  constructor(private http: HttpClient) {
    this.restoreSession();
  }

  async loadConfig(): Promise<GoogleConfig> {
    try {
      const config = await lastValueFrom(
        this.http.get<GoogleConfig>('assets/google-config.json')
      );
      if (config?.clientId) {
        this.clientId = config.clientId;
      }
      if (config?.apiKey) {
        this.apiKey = config.apiKey;
      }
      return config;
    } catch {
      return { clientId: this.clientId, apiKey: this.apiKey };
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    await this.loadConfig();

    if (Capacitor.getPlatform() !== 'web') {
      await GoogleAuth.initialize({
        clientId: this.clientId,
        scopes: ['profile', 'email', 'https://www.googleapis.com/auth/drive.appdata'],
        grantOfflineAccess: true,
      }).catch((err) => console.warn('[GoogleAuth] init warning:', err));
    }
    this.isInitialized = true;
  }

  async signIn(): Promise<GoogleUser> {
    await this.initialize();

    if (!this.clientId || this.clientId === DEFAULT_CLIENT_ID) {
      throw new Error(
        'Google Web Client ID no está configurado. Por favor, configura GOOGLE_WEB_CLIENT_ID en key.properties o en tu entorno.'
      );
    }

    try {
      const user = await GoogleAuth.signIn();
      const googleUser: GoogleUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        givenName: user.givenName,
        familyName: user.familyName,
        imageUrl: user.imageUrl,
        accessToken: user.authentication?.accessToken,
      };
      this.currentUser.set(googleUser);
      this.saveSession(googleUser);
      return googleUser;
    } catch (error: any) {
      console.error('[GoogleAuth] Sign-in error:', error);
      throw error;
    }
  }

  async signOut(): Promise<void> {
    try {
      if (Capacitor.getPlatform() !== 'web') {
        await GoogleAuth.signOut();
      }
    } catch (err) {
      console.warn('[GoogleAuth] Sign-out warning:', err);
    } finally {
      this.currentUser.set(null);
      localStorage.removeItem(GOOGLE_AUTH_STORAGE_KEY);
    }
  }

  async getAccessToken(): Promise<string | null> {
    const user = this.currentUser();
    if (user?.accessToken) return user.accessToken;

    try {
      const refreshed = await GoogleAuth.refresh();
      if (refreshed?.accessToken && user) {
        const updated = { ...user, accessToken: refreshed.accessToken };
        this.currentUser.set(updated);
        this.saveSession(updated);
        return refreshed.accessToken;
      }
    } catch (err) {
      console.warn('[GoogleAuth] Refresh token error:', err);
    }
    return null;
  }

  getClientId(): string {
    return this.clientId;
  }

  getApiKey(): string {
    return this.apiKey;
  }

  private saveSession(user: GoogleUser): void {
    localStorage.setItem(GOOGLE_AUTH_STORAGE_KEY, JSON.stringify(user));
  }

  private restoreSession(): void {
    const saved = localStorage.getItem(GOOGLE_AUTH_STORAGE_KEY);
    if (saved) {
      try {
        const user: GoogleUser = JSON.parse(saved);
        this.currentUser.set(user);
      } catch {}
    }
  }
}
