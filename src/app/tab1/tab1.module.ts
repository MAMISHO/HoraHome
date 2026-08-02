import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { Tab1Page } from './tab1.page';
import { Tab1PageRoutingModule } from './tab1-routing.module';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    Tab1PageRoutingModule,
    SharedModule,
    BaseChartDirective,
  ],
  declarations: [Tab1Page],
  providers: [provideCharts(withDefaultRegisterables())],
})
export class Tab1PageModule {}
