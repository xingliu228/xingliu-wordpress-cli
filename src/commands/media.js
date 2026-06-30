const fs = require('fs');
const { table, success, error, json, formatDate } = require('../utils');

function register(program, getClient) {
  const media = program.command('media').description('媒体管理');

  media.command('list')
    .description('列出媒体')
    .option('-n, --number <n>', '每页数量', '20')
    .option('--json', 'JSON 格式')
    .action(async (opts) => {
      const { client } = getClient();
      const res = await client.get('/wp/v2/media', { per_page: opts.number });
      if (opts.json) return json(res.data);
      console.log(table(
        ['ID', '类型', '文件名', '上传日期'],
        res.data.map(m => [m.id, m.mime_type, m.title.rendered?.substring(0, 40) || '-', formatDate(m.date)])
      ));
    });

  media.command('get <id>')
    .description('查看媒体详情')
    .option('--json', 'JSON 格式')
    .action(async (id, opts) => {
      const { client } = getClient();
      const res = await client.get(`/wp/v2/media/${id}`);
      if (opts.json) return json(res.data);
      const m = res.data;
      console.log(`  ID: ${m.id}\n  文件: ${m.title.rendered}\n  类型: ${m.mime_type}\n  大小: ${m.media_details?.filesize || '-'} 字节\n  URL: ${m.source_url}\n  日期: ${formatDate(m.date)}`);
    });

  media.command('upload <file>')
    .description('上传媒体文件')
    .option('--json', 'JSON 格式')
    .action(async (file, opts) => {
      const { client } = getClient();
      if (!fs.existsSync(file)) return error(`文件不存在: ${file}`);
      const res = await client.upload('/wp/v2/media', file, fs);
      if (opts.json) return json(res.data);
      success(`上传成功: ID=${res.data.id}, URL=${res.data.source_url}`);
    });

  media.command('delete <id>')
    .description('删除媒体')
    .option('--force', '永久删除')
    .action(async (id, opts) => {
      const { client } = getClient();
      await client.delete(`/wp/v2/media/${id}`, opts.force ? { force: true } : {});
      success(`媒体 ${id} 已删除`);
    });
}

module.exports = { register };
