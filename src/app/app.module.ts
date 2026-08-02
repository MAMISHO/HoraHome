import { NgModule, APP_INITIALIZER } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { RouteReuseStrategy } from '@angular/router';

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
    provideTranslateService({ defaultLanguage: 'es' }),
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
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
