import * as bcrypt from 'bcrypt';

async function main() {
  const hash = await bcrypt.hash('123456', 10);
  console.log("Hash generado:", hash);
}

main();
