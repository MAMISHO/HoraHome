# Especificación Técnica y Arquitectura: HoraHome

## 1. Ficha Técnica General
* **Nombre de la App**: HoraHome
* **Package ID**: `com.horahome.app`
* **Framework**: Ionic 8 + Angular 18+ (**NgModule / Module Components architecture**)
* **Plataforma Nativa**: Capacitor 6+ (Android)
* **ORM & Base de Datos Local**: TypeORM (`typeorm`, `reflect-metadata`) sobre `@capacitor-community/sqlite` (`db_horahome.db`)
* **Internacionalización (i18n)**: `@ngx-translate/core` + `@ngx-translate/http-loader` (Idioma por defecto: Español `es`, soporta Inglés `en` y Francés `fr`)
* **Autenticación e Integración Nube**: `@codetrix-studio/capacitor-google-auth` + Google Drive REST API (`appDataFolder`)

---

## 2. Estructura de Directorios (NgModule & TypeORM)

```text
HoraHome/
├── docs/
├── src/
│   ├── assets/
│   │   └── i18n/
│   │       ├── es.json  (Idioma por defecto)
│   │       ├── en.json
│   │       └── fr.json
│   ├── app/
│   │   ├── app.module.ts
│   │   ├── app-routing.module.ts
│   │   ├── core/
│   │   │   ├── entities/
│   │   │   │   ├── client.entity.ts
│   │   │   │   ├── service.entity.ts
│   │   │   │   ├── work-log.entity.ts
│   │   │   │   └── brussels-holiday.entity.ts
│   │   │   └── services/
│   │   │       ├── database.service.ts
│   │   │       ├── google-auth.service.ts
│   │   │       ├── google-drive.service.ts
│   │   │       └── language.service.ts
│   │   ├── shared/
│   │   │   └── shared.module.ts
│   │   └── tabs/
│   │       ├── tabs.module.ts
│   │       ├── tabs.router.module.ts
│   │       ├── dashboard/
│   │       │   └── dashboard.module.ts
│   │       ├── calendar/
│   │       │   └── calendar.module.ts
│   │       ├── work-logs/
│   │       │   └── work-logs.module.ts
│   │       ├── clients/
│   │       │   └── clients.module.ts
│   │       └── reports-settings/
│   │           └── reports-settings.module.ts
```

---

## 3. Entidades TypeORM (en Inglés)

### 3.1 `Client` (`client.entity.ts`)
```typescript
@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: false })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  address?: string;

  @Column({ type: 'varchar', nullable: true })
  phone?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.0 })
  hourlyRate: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => WorkLog, (workLog) => workLog.client)
  workLogs: WorkLog[];
}
```

### 3.2 `Service` (`service.entity.ts`)
```typescript
@Entity('services')
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true, nullable: false })
  name: string;

  @OneToMany(() => WorkLog, (workLog) => workLog.service)
  workLogs: WorkLog[];
}
```

### 3.3 `WorkLog` (`work-log.entity.ts`)
```typescript
@Entity('work_logs')
export class WorkLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date', nullable: false })
  workDate: string;

  @ManyToOne(() => Client, (client) => client.workLogs, { onDelete: 'RESTRICT', nullable: false })
  client: Client;

  @ManyToOne(() => Service, (service) => service.workLogs, { onDelete: 'RESTRICT', nullable: false })
  service: Service;

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: false })
  hours: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

### 3.4 `BrusselsHoliday` (`brussels-holiday.entity.ts`)
```typescript
@Entity('brussels_holidays')
export class BrusselsHoliday {
  @PrimaryColumn({ type: 'date' })
  holidayDate: string;

  @Column({ type: 'varchar', nullable: false })
  nameFr: string;

  @Column({ type: 'varchar', nullable: false })
  nameNl: string;

  @Column({ type: 'integer', nullable: false })
  year: number;
}
```

---

## 4. Internacionalización (i18n)
* Idioma predeterminado: Español (`es`).
* Idiomas soportados: Español (`es`), Inglés (`en`), Francés (`fr`).
* Gestión centralizada vía `LanguageService` almacenando preferencia del usuario.
