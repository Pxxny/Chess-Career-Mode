import json
import os
from pathlib import Path
import subprocess
import sys
import time

project = Path(sys.argv[1]).resolve()
label = sys.argv[2]
checks = sys.argv[3:]
output = Path(__file__).parent
results = []
for check in checks:
    command = ['npm', 'run', check]
    log = output / f'{label}-{check.replace(":", "-")}.log'
    print(f'RUN {label}: {" ".join(command)}', flush=True)
    start = time.perf_counter()
    with log.open('w') as stream:
        process = subprocess.run(command, cwd=project, stdout=stream, stderr=subprocess.STDOUT, env=os.environ.copy())
    result = dict(command=command, project=str(project), seconds=round(time.perf_counter() - start, 3), exit_code=process.returncode, log=log.name)
    results.append(result)
    print(json.dumps(result), flush=True)
    print(log.read_text()[-5000:], flush=True)
    (output / f'{label}-results.json').write_text(json.dumps(results, indent=2) + '\n')
    if process.returncode:
        sys.exit(process.returncode)
