import { Injectable, signal } from '@angular/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { Capacitor } from '@capacitor/core';

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  givenName?: string;
  familyName?: string;
  imageUrl?: string;
  accessToken?: string;
}

const GOOGLE_AUTH_STORAGE_KEY = 'horahome_google_user';

@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  readonly currentUser = signal<GoogleUser | null>(null);
  private isInitialized = false;

  constructor() {
    this.restoreSession();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (Capacitor.getPlatform() !== 'web') {
      await GoogleAuth.initialize({
        clientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
        scopes: ['profile', 'email', 'https://www.googleapis.com/auth/drive.appdata'],
        grantOfflineAccess: true,
      }).catch((err) => console.warn('[GoogleAuth] init warning:', err));
    }
    this.isInitialized = true;
  }

  async signIn(): Promise<GoogleUser | null> {
    await this.initialize();
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
    } catch (error) {
      console.error('[GoogleAuth] Sign-in error:', error);
      return null;
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
