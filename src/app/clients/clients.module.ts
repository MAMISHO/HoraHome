import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ClientsPage } from './clients.page';
import { ClientsPageRoutingModule } from './clients-routing.module';
import { ClientModalComponent } from './client-modal/client-modal.component';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ClientsPageRoutingModule,
    SharedModule,
  ],
  declarations: [ClientsPage, ClientModalComponent],
})
export class ClientsPageModule {}
