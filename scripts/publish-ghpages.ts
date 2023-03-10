import * as ghpages from 'gh-pages';
import * as path from 'path';

process.stdout.write('Publishing to "gh-pages" branch... ');
ghpages.publish(
    path.resolve(new URL(import.meta.url).pathname, '..', '..', 'docs/examples'),
    {message: 'Updated documentation'},
    function (err) {
        if (err) {
            process.stdout.write('error\n');
            console.error(err);
            process.exit(1);
        } else {
            process.stdout.write('success\n');
            process.exit(0);
        }
    }
);
