import * as bcrypt from 'bcrypt';

bcrypt.hash('123456', 10).then((hash) => {
  console.log('Hash generado para "123456":', hash);
});
