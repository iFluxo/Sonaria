import { Collection } from "seyfert";
import { SonariaBase } from "../SonariaBase";

/**
 * Manages the collection of a data model.
 */
export abstract class BaseManager<V> extends SonariaBase {
  /**
   * The collection of items for this manager.
   */
  collection = new Collection<string, V>();
  /**
   * The size of the collection.
   */
  get size() {
    return this.collection.size;
  }
}
