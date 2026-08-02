import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ReportsSettingsPage } from './reports-settings.page';

const routes: Routes = [
  {
    path: '',
    component: ReportsSettingsPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ReportsSettingsPageRoutingModule {}
