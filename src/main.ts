import 'reflect-metadata';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { defineCustomElements as jeepSqlite } from 'jeep-sqlite/loader';

import { AppModule } from './app/app.module';

jeepSqlite(window);

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.log(err));
