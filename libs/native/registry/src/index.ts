import winreg from 'winreg';

export type RegistryHive = 'HKCU' | 'HKLM' | 'HKCR' | 'HKU' | 'HKCC';
export type RegistryType = 'REG_SZ' | 'REG_DWORD' | 'REG_BINARY' | 'REG_EXPAND_SZ';

export const HIVE_MAP = {
  HKCU: winreg.HKCU,
  HKLM: winreg.HKLM,
  HKCR: winreg.HKCR,
  HKU: winreg.HKU,
  HKCC: winreg.HKCC
};

function buildKeyPath(hive: RegistryHive, path: string): string {
  return `\\${hive}\\${path.replace(/^\\+/g, '')}`;
}

export async function readValue(hive: RegistryHive, path: string, key: string): Promise<any> {
  const regKey = new winreg({
    hive: HIVE_MAP[hive],
    key: buildKeyPath(hive, path)
  });

  return new Promise((resolve, reject) => {
    regKey.get(key, (err, item) => {
      err ? reject(new Error(`读取注册表失败: ${err.message}`)) : resolve(item.value);
    });
  });
}

export async function writeValue(
  hive: RegistryHive,
  path: string,
  key: string,
  valueType: RegistryType,
  value: string | number
): Promise<void> {
  const regKey = new winreg({
    hive: HIVE_MAP[hive],
    key: buildKeyPath(hive, path)
  });

  return new Promise((resolve, reject) => {
    regKey.set(key, valueType, value as string, (err) => {
      err ? reject(new Error(`写入注册表失败: ${err.message}`)) : resolve();
    });
  });
}

export async function deleteKey(hive: RegistryHive, path: string): Promise<void> {
  const regKey = new winreg({
    hive: HIVE_MAP[hive],
    key: buildKeyPath(hive, path)
  });

  return new Promise((resolve, reject) => {
    regKey.keyExists((exists) => {
      if (!exists) return resolve();
      regKey.destroy((err) => {
        err ? reject(new Error(`删除注册表键失败: ${err.message}`)) : resolve();
      });
    });
  });
}
