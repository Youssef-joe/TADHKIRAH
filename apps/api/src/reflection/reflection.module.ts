import { Module } from '@nestjs/common';
import { ReflectionController } from './reflection.controller.js';
import { ReflectionService } from './reflection.service.js';

@Module({ controllers: [ReflectionController], providers: [ReflectionService] })
export class ReflectionModule {}
