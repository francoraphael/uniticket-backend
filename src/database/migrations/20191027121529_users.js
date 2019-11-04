exports.up = async knex => {
  return knex.schema.createTable('users', tbl => {
    tbl.increments();
    tbl.string('name').notNullable();
    tbl.string('email').notNullable();
    tbl.string('password').notNullable();
    tbl
      .boolean('active')
      .defaultTo(false)
      .notNullable();
    tbl
      .enu('role', ['admin', 'discente', 'servidor', 'visitante'], {
        userNative: true,
        enumName: 'role',
      })
      .defaultTo('visitante')
      .notNullable();
    tbl.string('reset_token', [16]);
    tbl.string('confirmation_token', [16]);
    tbl.timestamps(true, true);
  });
};

exports.down = async knex => knex.schema.dropTableIfExists('users');
