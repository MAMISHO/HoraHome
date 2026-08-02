import { Component, OnInit } from '@angular/core';
import { ModalController, ViewWillEnter } from '@ionic/angular';
import { DatabaseService } from '../core/services/database.service';
import { Client } from '../core/entities/client.entity';
import { ClientModalComponent } from './client-modal/client-modal.component';

@Component({
  selector: 'app-clients',
  templateUrl: './clients.page.html',
  styleUrls: ['./clients.page.scss'],
  standalone: false,
})
export class ClientsPage implements OnInit, ViewWillEnter {
  allClients: Client[] = [];
  displayedClients: Client[] = [];
  showInactive = false;

  constructor(
    private dbService: DatabaseService,
    private modalCtrl: ModalController
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadClients();
  }

  async ionViewWillEnter(): Promise<void> {
    await this.loadClients();
  }

  async loadClients(): Promise<void> {
    if (!this.dbService.isReady()) return;

    this.allClients = await this.dbService.clientRepo.find({
      order: { name: 'ASC' },
    });

    this.filterClients();
  }

  filterClients(): void {
    if (this.showInactive) {
      this.displayedClients = [...this.allClients];
    } else {
      this.displayedClients = this.allClients.filter((c) => c.isActive);
    }
  }

  async openClientModal(client?: Client): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: ClientModalComponent,
      componentProps: { client },
      breakpoints: [0, 0.75, 1.0],
      initialBreakpoint: 0.75,
    });

    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data?.saved) {
      await this.loadClients();
    }
  }
}
