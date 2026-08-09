import { Injectable, Injector } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, from } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { GoogleAuthService } from '../services/google-auth.service';
import { ToastController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  private isRefreshing = false;
  private translateService: TranslateService | null = null;

  constructor(
    private authService: GoogleAuthService,
    private toastCtrl: ToastController,
    private injector: Injector
  ) {}

  private get translate(): TranslateService {
    if (!this.translateService) {
      this.translateService = this.injector.get(TranslateService);
    }
    return this.translateService;
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        // Only intercept 401 Unauthorized for Google APIs
        if (error.status !== 401 || !req.url.includes('googleapis.com')) {
          return throwError(() => error);
        }

        if (this.isRefreshing) {
          return throwError(() => error);
        }

        this.isRefreshing = true;

        return from(this.authService.getAccessToken()).pipe(
          switchMap(token => {
            this.isRefreshing = false;
            
            if (token) {
              const cloned = req.clone({
                setHeaders: {
                  Authorization: `Bearer ${token}`
                }
              });
              return next.handle(cloned);
            }

            this.handleSessionExpired();
            return throwError(() => new Error('Session expired'));
          }),
          catchError(err => {
            this.isRefreshing = false;
            this.handleSessionExpired();
            return throwError(() => err);
          })
        );
      })
    );
  }

  private async handleSessionExpired(): Promise<void> {
    await this.authService.signOut();
    const toast = await this.toastCtrl.create({
      message: this.translate.instant('AUTH.SESSION_EXPIRED') || 'Sesión expirada. Por favor inicie sesión nuevamente.',
      duration: 4000,
      color: 'danger'
    });
    await toast.present();
  }
}
