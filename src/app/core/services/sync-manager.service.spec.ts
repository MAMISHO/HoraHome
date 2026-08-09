import { TestBed } from '@angular/core/testing';
import { SyncManagerService } from './sync-manager.service';
import { DatabaseService } from './database.service';
import { GoogleDriveService } from './google-drive.service';
import { ExcelExportService } from './excel-export.service';
import { GoogleAuthService } from './google-auth.service';

describe('SyncManagerService', () => {
  let service: SyncManagerService;
  let dbServiceSpy: jasmine.SpyObj<DatabaseService>;
  let driveServiceSpy: jasmine.SpyObj<GoogleDriveService>;
  let excelServiceSpy: jasmine.SpyObj<ExcelExportService>;
  let authServiceSpy: jasmine.SpyObj<GoogleAuthService>;

  beforeEach(() => {
    const dbSpy = jasmine.createSpyObj('DatabaseService', ['isReady'], {
      workLogRepo: jasmine.createSpyObj('Repository', ['find'])
    });
    const driveSpy = jasmine.createSpyObj('GoogleDriveService', [
      'hasConflict',
      'checkAndPromptRestore',
      'uploadBackup',
      'getOrCreateFolder',
      'uploadOrUpdateFile'
    ]);
    const excelSpy = jasmine.createSpyObj('ExcelExportService', ['generateClientMonthExcel']);
    const authSpy = jasmine.createSpyObj('GoogleAuthService', ['getAccessToken']);

    TestBed.configureTestingModule({
      providers: [
        SyncManagerService,
        { provide: DatabaseService, useValue: dbSpy },
        { provide: GoogleDriveService, useValue: driveSpy },
        { provide: ExcelExportService, useValue: excelSpy },
        { provide: GoogleAuthService, useValue: authSpy }
      ]
    });

    service = TestBed.inject(SyncManagerService);
    dbServiceSpy = TestBed.inject(DatabaseService) as jasmine.SpyObj<DatabaseService>;
    driveServiceSpy = TestBed.inject(GoogleDriveService) as jasmine.SpyObj<GoogleDriveService>;
    excelServiceSpy = TestBed.inject(ExcelExportService) as jasmine.SpyObj<ExcelExportService>;
    authServiceSpy = TestBed.inject(GoogleAuthService) as jasmine.SpyObj<GoogleAuthService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should abort sync if no Google token is obtained', async () => {
    authServiceSpy.getAccessToken.and.returnValue(Promise.resolve(null));

    await expectAsync(service.syncAll()).toBeRejectedWithError(/Sincronización cancelada/);
    expect(driveServiceSpy.hasConflict).not.toHaveBeenCalled();
  });

  it('should cancel normal sync and trigger restore prompt if a cloud conflict is detected', async () => {
    authServiceSpy.getAccessToken.and.returnValue(Promise.resolve('mock-token'));
    driveServiceSpy.hasConflict.and.returnValue(Promise.resolve(true));

    await service.syncAll();

    expect(driveServiceSpy.hasConflict).toHaveBeenCalledWith('mock-token');
    expect(driveServiceSpy.checkAndPromptRestore).toHaveBeenCalled();
    expect(driveServiceSpy.uploadBackup).not.toHaveBeenCalled();
  });

  it('should execute full sync (upload backup and excels) if there is no conflict', async () => {
    authServiceSpy.getAccessToken.and.returnValue(Promise.resolve('mock-token'));
    driveServiceSpy.hasConflict.and.returnValue(Promise.resolve(false));
    dbServiceSpy.isReady.and.returnValue(true);
    
    const mockLogsRepo = dbServiceSpy.workLogRepo as jasmine.SpyObj<any>;
    mockLogsRepo.find.and.returnValue(Promise.resolve([]));
    driveServiceSpy.getOrCreateFolder.and.returnValue(Promise.resolve('folder-id'));

    await service.syncAll();

    expect(driveServiceSpy.hasConflict).toHaveBeenCalledWith('mock-token');
    expect(driveServiceSpy.uploadBackup).toHaveBeenCalled();
    expect(mockLogsRepo.find).toHaveBeenCalled();
  });
});
