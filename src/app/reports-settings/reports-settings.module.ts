import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ReportsSettingsPage } from './reports-settings.page';
import { ReportsSettingsPageRoutingModule } from './reports-settings-routing.module';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ReportsSettingsPageRoutingModule,
    SharedModule,
  ],
  declarations: [ReportsSettingsPage],
})
export class ReportsSettingsPageModule {}
