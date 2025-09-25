import { IsNumber, IsOptional, IsPositive, IsNotEmpty, IsString, Validate, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

@ValidatorConstraint({ async: false })
export class ExactlyOneOf implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const [property1, property2] = args.constraints;
    const obj = args.object as any;
    const hasProperty1 = obj[property1] != null;
    const hasProperty2 = obj[property2] != null;
    return (hasProperty1 && !hasProperty2) || (!hasProperty1 && hasProperty2);
  }

  defaultMessage(args: ValidationArguments) {
    const [property1, property2] = args.constraints;
    return `Debe especificar exactamente uno: ${property1} o ${property2}`; 
  }
}

export class CreatePaymentDto {
  @Validate(ExactlyOneOf, ['credit_id', 'sale_id'])
  @IsOptional()
  @IsNumber()
  credit_id?: number;

  @IsOptional()
  @IsNumber()
  sale_id?: number;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsNumber()
  payment_method_id: number;

  @IsNumber()
  @IsNotEmpty()
  user_id: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
