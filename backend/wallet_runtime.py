"""Offline wallet construction only; import performs no wallet or secret access."""
import json
import os
import fcntl
import threading
from contextlib import contextmanager
from pathlib import Path
import rgb_lib as rgb

WALLET_DIR = Path.home() / "dev/rueda-rgb/rueda-test-wallet"
ASSET_ID = "rgb:Jf~5_Vys-BJN7Gdj-UGcxEcR-FutiMwF-v~38rxx-2vYwt00"


def load_wallet(wallet_dir=None):
    wallet_dir = WALLET_DIR if wallet_dir is None else Path(wallet_dir)
    with (wallet_dir / "recovery.json").open() as f:
        saved = json.load(f)

    keys = rgb.SinglesigKeys(
        account_xpub_vanilla=saved["account_xpub_vanilla"],
        account_xpub_colored=saved["account_xpub_colored"],
        vanilla_keychain=None,
        master_fingerprint=saved["master_fingerprint"],
        mnemonic=saved["mnemonic"],
        witness_version=rgb.WitnessVersion.SEG_WIT_V0,
    )

    return rgb.Wallet(
        rgb.WalletData(
            data_dir=str(wallet_dir / "data"),
            bitcoin_network=rgb.BitcoinNetwork.SIGNET_CUSTOM,
            database_type=rgb.DatabaseType.SQLITE,
            max_allocations_per_utxo=5,
            supported_schemas=[rgb.AssetSchema.NIA],
        ),
        keys,
    )




_ACCESS_LOCK = threading.Lock()


@contextmanager
def wallet_session(wallet_dir=None):
    """Serialize app wallet use across threads/processes, without waiting indefinitely."""
    directory = WALLET_DIR if wallet_dir is None else Path(wallet_dir)
    if not _ACCESS_LOCK.acquire(blocking=False):
        raise RuntimeError("Wallet is busy")
    fd = None
    try:
        # Do not create a missing wallet directory. Lock files contain no secrets.
        fd = os.open(directory / ".rueda-access.lock", os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield load_wallet(directory)
    finally:
        if fd is not None:
            os.close(fd)
        _ACCESS_LOCK.release()
