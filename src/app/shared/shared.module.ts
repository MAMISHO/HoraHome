import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslatePipe, TranslateDirective } from '@ngx-translate/core';
import { WorkLogModalComponent } from './components/work-log-modal/work-log-modal.component';

@NgModule({
  declarations: [WorkLogModalComponent],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TranslatePipe,
    TranslateDirective,
  ],
  exports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TranslatePipe,
    TranslateDirective,
    WorkLogModalComponent,
  ],
})
export class SharedModule {}
