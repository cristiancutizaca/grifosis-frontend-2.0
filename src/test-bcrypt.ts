import * as bcrypt from 'bcrypt';

const password = '123456';
const hash = '$2b$10$JMEVpQUpUj2n7hLPGtN9FugDY7exLMg1O5ECI76FqUhzGmHCMZo9O';

bcrypt.compare(password, hash).then((result) => {
  console.log('¿Coincide?', result); // ← debería decir true
});
