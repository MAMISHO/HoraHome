import { InjectionToken } from '@angular/core';

export type SqlJsInitFunction = (config?: any) => Promise<any>;

export const SQLJS_LOADER_TOKEN = new InjectionToken<() => Promise<SqlJsInitFunction>>(
  'SQLJS_LOADER_TOKEN',
  {
    providedIn: 'root',
    factory: () => async () => {
      // Si la ventana ya tiene initSqlJs (provisto por script de Angular en angular.json)
      if (typeof (window as any).initSqlJs === 'function') {
        return (window as any).initSqlJs;
      }

      // Si no, cargamos dinámicamente el script de assets/sql-wasm.js
      return new Promise<SqlJsInitFunction>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'assets/sql-wasm.js';
        script.onload = () => {
          if (typeof (window as any).initSqlJs === 'function') {
            resolve((window as any).initSqlJs);
          } else {
            reject(new Error('initSqlJs was not defined by assets/sql-wasm.js script'));
          }
        };
        script.onerror = (err) => reject(err);
        document.head.appendChild(script);
      });
    },
  }
);
