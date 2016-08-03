import Pokemon from '~/Pokemon'

import Protobuf from 'protobufjs'
import path from 'path'

var rootPath= path.join(__dirname,'../../')
var bufferFile = Protobuf.loadProtoFile({ root: rootPath, file: "POGOProtos/POGOProtos.proto" })
const POGOProtos = bufferFile.build("POGOProtos")

class Item {
  constructor(id){
    this.count = 0
    this.id = id

    // Specifyes the max amount of this
    // item that you want to keep
    this.max = Infinity
  }

  recycle(count){}
}


class useOnEncounter extends Item {
  constructor(id){ super(id) }

  /**
   * [useOn description]
   * @param  {[type]} pokemon [description]
   * @return {[type]}         [description]
   */
  async useOn(pokemon){
    if(!pokemon.isCatching)
      throw new Error('That pokemon already have max HP')
  }
}

class useOnWounded extends Item {
  constructor(id){ super(id) }

  /**
   * [useOn description]
   * @param  {[type]} pokemon [description]
   * @return {[type]}         [description]
   */
  async useOn(pokemon) {
    // Validate that the pokemon needs HP
    if(!pokemon.isWounded)
      throw new Error('That pokemon already have max HP')

    await this.parent.Call([{
      request: 'USE_ITEM_CAPTURE',
      message: {
        item_id: this.id,
        encounter_id: pokemon.encounter_id,
        spawn_point_id: pokemon.spawn_point_id,
      }
    }])
    this.count--
  }
}

class useOnDead extends Item {
  constructor(id){ super(id) }

  /**
   * [useOn description]
   * @return {[type]} [description]
   */
  async useOn(){
    // Validate that the pokemon needs HP
    if(!pokemon.isDead)
      throw new Error('That pokemon already have max HP')

    this.parent.Call([{
      request: 'USE_ITEM_REVIVE',
      message: {
        item_id: this.id,
        pokemon_id: pokemon.pokemon_id,
      }
    }])
    this.count--
  }
}

var usePotion = item_id => pokemon => {
  return this.parent.Call([{
    request: 'USE_ITEM_POTION',
    message: {
      item_id,
      pokemon_id: pokemon.pokemon_id,
    }
  }])
}



/**
 * This will hold an array with items that you have
 */
class Items {
  constructor(){
    Object.assign(this, {
      pokeBall: new useOnEncounter(1),
      greatBall: new useOnEncounter(2),
      ultraBall: new useOnEncounter(3),
      masterBall: new useOnEncounter(4),
      potion: usePotion(101),
      superPotion: usePotion(102),
      hyperPotion: usePotion(103),
      maxPotion: usePotion(104),
      revive: new useOnDead(201),
      maxRevive: new useOnDead(202),
      luckyEgg: new Item(301),
      incenseOrdinary: new Item(401),
      // incenseSpicy: {id: 0}
      // incenseCool: {id: 0}
      // incenseFloral: {id: 0}
      troyDisk: new Item(501),
      // xAttack: {id: 0}
      // xDefense: {id: 0}
      // xMiracle: {id: 0}
      razzBerry: new useOnEncounter(701),
      blukBerry: new useOnEncounter(702),
      nanabBerry: new useOnEncounter(703),
      weparBerry: new useOnEncounter(704),
      pinapBerry: new useOnEncounter(705),
      incubatorBasicUnlimited: new Item(901),
      incubatorBasic: new Item(902)
    })
  }


  /**
   * Gets the best ball you can use
   * agains a pokemon you are trying to catch
   *
   * @return {Item} the poke ball you can use
   */
  get bestBall() {
    return 
      this.master_ball.count && this.master_ball ||
      this.ultra_ball.count && this.ultra_ball ||
      this.great_ball.count && this.great_ball ||
      this.poke_ball.count && this.poke_ball
  }



  /**
   * Returns whatever or not the bag is full
   *
   * @return {Boolean} true if the bag is full
   */
  get isFull() {
    return false
  }



  /**
   * Returns number of items in the inventory
   *
   * @return {Boolean} true if the bag is full
   */
  get count() {
    return 
      pokeBall.count+
      greatBall.count+
      ultraBall.count+
      masterBall.count+
      potion.count+
      superPotion.count+
      hyperPotion.count+
      maxPotion.count+
      revive.count+
      maxRevive.count+
      luckyEgg.count+
      incenseOrdinary.count+
      troyDisk.count+
      razzBerry.count+
      blukBerry.count+
      nanabBerry.count+
      weparBerry.count+
      pinapBerry.count+
      incubatorBasicUnlimited.count+
      incubatorBasic
  }
}



/**
 * This will hold an array with pokemons that you own
 */
class Pokemons extends Array {}

/**
 * This will hold an array with eggs that you own
 */
class Eggs extends Array {}

/**
 * This will hold an array with candies that you have
 */
class Candies extends Array {}

class Inventory {
  constructor(parent){
    this.parent = parent
    // this.items = new Items
    this.pokemons = new Pokemons
    this.eggs = new Eggs
    this.candies = new Candies
  }



  /**
   * Updates the inventory from the cloud
   * @return {Promise} Resolves to true/false if success
   */
  async update() {
    let res = await this.parent.Call([{
      request: 'GET_INVENTORY',
      message: {
        last_timestamp_ms: 0
      }
    }])

    let inventory = {
      pokemons: [],
      items: {},
      eggs: [],
      candies: []
    }

    var itemData = POGOProtos.Inventory.Item.ItemId
    itemData = Object.keys(itemData).reduce((obj, key) => {
      obj[ itemData[key] ] = key.toLowerCase().replace('item_', '')
      inventory.items[obj[itemData[key]]] = new POGOProtos.Inventory.InventoryItem
      return obj
    }, {})


    for(let thing of res.GetInventoryResponse.inventory_delta.inventory_items){
      let data = thing.inventory_item_data

      if (data.pokemon_data) {
        let pokemon = new Pokemon(data.pokemon_data, this)
        data.pokemon_data.is_egg
          ? this.eggs.push(pokemon)
          : this.pokemons.push(pokemon)
      }

      //items
      if (data.item)
        inventory.items[itemData[data.item.item_id]] = new Item(data.item, this)


      //candy
      if (data.candy)
        this.candies.push(new Item(data.candy, this))
  
      //player stats
      if (data.player_stats)
        Object.assign(this.player, data.player_stats)
    }
    return true
  }



  /**
   * Adds the items from a checkpoint in to the Inventory
   */
  add() {
  }

}


export default Inventory