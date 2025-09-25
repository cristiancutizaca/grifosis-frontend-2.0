import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Expense } from './entities/expense.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private expensesRepository: Repository<Expense>,
  ) { }

  async create(createExpenseDto: CreateExpenseDto): Promise<Expense> {
    const expense = this.expensesRepository.create({
      ...createExpenseDto
    });
    return await this.expensesRepository.save(expense);
  }


  async findAll(filters?: any): Promise<Expense[]> {
    const query = this.expensesRepository.createQueryBuilder('expense');

    if (filters?.startDate && filters?.endDate) {
      query.andWhere('expense.expense_date BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate
      });
    }

    if (filters?.category) {
      query.andWhere('expense.category = :category', { category: filters.category });
    }

    if (filters?.is_recurring !== undefined) {
      query.andWhere('expense.is_recurring = :is_recurring', {
        is_recurring: filters.is_recurring
      });
    }

    return query.orderBy('expense.expense_date', 'DESC').getMany();
  }

  async findOne(id: number): Promise<Expense> {
    const expense = await this.expensesRepository.findOne({
      where: { expense_id: id }
    });

    if (!expense) {
      throw new Error(`Expense with ID ${id} not found`);
    }

    return expense;
  }

  async uploadReceipt(id: number, filePath: string): Promise<Expense> {
    const expense = await this.findOne(id);
    expense.receipt_file = filePath;
    return await this.expensesRepository.save(expense);
  }

  async getExpensesByCategory(): Promise<any> {
    const result = await this.expensesRepository
      .createQueryBuilder('expense')
      .select('expense.category', 'category')
      .addSelect('SUM(expense.amount)', 'total')
      .groupBy('expense.category')
      .getRawMany();

    return result.reduce((acc, item) => {
      acc[item.category] = parseFloat(item.total);
      return acc;
    }, {});
  }
}
