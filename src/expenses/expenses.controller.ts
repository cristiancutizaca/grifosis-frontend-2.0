import { Controller, Get, Post, Body, Param, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ExpensesService } from './expenses.service';
import { Express } from 'express';

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) { }

  @Post()
  create(@Body() createExpenseDto: any) {
    return this.expensesService.create(createExpenseDto);
  }

  @Get()
  findAll(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('category') category?: string,
    @Query('recurring') recurring?: string
  ) {
    const filters: any = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (category) filters.category = category;
    if (recurring !== undefined) filters.is_recurring = recurring === 'true';

    return this.expensesService.findAll(filters);
  }

  @Get('categories')
  getExpensesByCategory() {
    return this.expensesService.getExpensesByCategory();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.expensesService.findOne(+id);
  }

  @Post(':id/receipt')
  @UseInterceptors(FileInterceptor('file'))
  uploadReceipt(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    const filePath = `/uploads/receipts/${file.filename}`;
    return this.expensesService.uploadReceipt(+id, filePath);
  }

}

