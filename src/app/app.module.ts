import { NgModule, APP_INITIALIZER, LOCALE_ID } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { RouteReuseStrategy } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import localeFr from '@angular/common/locales/fr';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import {
  provideTranslateService,
  TranslatePipe,
  TranslateDirective,
} from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { DatabaseService } from './core/services/database.service';
import { LanguageService } from './core/services/language.service';
import { AuthInterceptor } from './core/interceptors/auth.interceptor';

// Registrar datos de localización para los pipes de fecha/moneda en español y francés
registerLocaleData(localeEs, 'es');
registerLocaleData(localeFr, 'fr');

export function initializeApp(
  dbService: DatabaseService,
  langService: LanguageService
): () => Promise<void> {
  return async () => {
    await langService.initialize();
    await dbService.initialize();
  };
}

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    HttpClientModule,
    IonicModule.forRoot(),
    AppRoutingModule,
    TranslatePipe,
    TranslateDirective,
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    { provide: LOCALE_ID, useValue: 'es' },
    provideTranslateService({ lang: 'es', fallbackLang: 'es' }),
    provideTranslateHttpLoader({
      prefix: './assets/i18n/',
      suffix: '.json',
    }),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [DatabaseService, LanguageService],
      multi: true,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
