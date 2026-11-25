"""Abstract base class for all data collectors."""

from abc import ABC, abstractmethod


class BaseCollector(ABC):
    """Base interface that every collector must implement.

    A collector is responsible for fetching data from an external source and
    returning it as a list of dictionaries ready for downstream processing.
    """

    @abstractmethod
    async def collect(self) -> list[dict]:
        """Fetch data from the external source and return raw records.

        Returns:
            A list of dictionaries, each representing one event or record
            from the external source.
        """
        ...

    @abstractmethod
    async def poll(self) -> None:
        """Run a single poll cycle: collect data and hand it to the sink.

        This method should call ``collect``, validate/transform results,
        ``produce`` them to the shared event sink and ``await`` its flush.
        """
        ...
