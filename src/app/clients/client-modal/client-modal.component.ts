import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { DatabaseService } from '../../core/services/database.service';
import { Client } from '../../core/entities/client.entity';

@Component({
  selector: 'app-client-modal',
  templateUrl: './client-modal.component.html',
  styleUrls: ['./client-modal.component.scss'],
  standalone: false,
})
export class ClientModalComponent implements OnInit {
  @Input() client?: Client;

  isEdit = false;
  name = '';
  phone = '';
  address = '';
  hourlyRate = 0.0;
  isActive = true;

  constructor(
    private modalCtrl: ModalController,
    private dbService: DatabaseService
  ) {}

  ngOnInit(): void {
    if (this.client) {
      this.isEdit = true;
      this.name = this.client.name;
      this.phone = this.client.phone || '';
      this.address = this.client.address || '';
      this.hourlyRate = Number(this.client.hourlyRate);
      this.isActive = this.client.isActive;
    }
  }

  async save(): Promise<void> {
    if (!this.name.trim() || !this.dbService.isReady()) return;

    let c: Client;
    if (this.isEdit && this.client) {
      c = this.client;
    } else {
      c = this.dbService.clientRepo.create();
    }

    c.name = this.name.trim();
    c.phone = this.phone.trim() || undefined;
    c.address = this.address.trim() || undefined;
    c.hourlyRate = Math.max(0, Number(this.hourlyRate));
    c.isActive = this.isActive;

    const saved = await this.dbService.clientRepo.save(c);
    this.modalCtrl.dismiss({ saved: true, client: saved });
  }

  dismiss(): void {
    this.modalCtrl.dismiss();
  }
}
